<?php
/**
 * REST API Subsystem
 *
 * Namespace: /wp-json/seo-autopilot/v1/
 *
 * @package SEO_Autopilot_Connector
 */

if (!defined('ABSPATH')) {
    exit;
}

class SEO_Autopilot_REST {

    private static $instance = null;
    const NAMESPACE = 'seo-autopilot/v1';

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    public function register_routes() {
        // 1. Status / Health Check
        register_rest_route(self::NAMESPACE, '/status', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_status'),
            'permission_callback' => '__return_true',
        ));

        // 2. Site Information (Scope: site:read)
        register_rest_route(self::NAMESPACE, '/site', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_site_info'),
            'permission_callback' => array($this, 'check_site_read_permission'),
        ));

        // 3. Posts Collection (Scope: content:read)
        register_rest_route(self::NAMESPACE, '/posts', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_posts'),
                'permission_callback' => array($this, 'check_content_read_permission'),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array($this, 'create_post'),
                'permission_callback' => array($this, 'check_content_write_permission'),
            ),
        ));

        // 4. Single Post Item (Scope: content:read / content:write)
        register_rest_route(self::NAMESPACE, '/posts/(?P<id>[\d]+)', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_single_post'),
                'permission_callback' => array($this, 'check_content_read_permission'),
            ),
            array(
                'methods'             => array('PUT', 'PATCH', 'POST'),
                'callback'            => array($this, 'update_post'),
                'permission_callback' => array($this, 'check_content_write_permission'),
            ),
        ));

        // 5. Pages Collection (Scope: content:read)
        register_rest_route(self::NAMESPACE, '/pages', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_pages'),
            'permission_callback' => array($this, 'check_content_read_permission'),
        ));

        // 6. Media Collection (Scope: media:read / media:write)
        register_rest_route(self::NAMESPACE, '/media', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_media'),
                'permission_callback' => array($this, 'check_media_read_permission'),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array($this, 'upload_media'),
                'permission_callback' => array($this, 'check_media_write_permission'),
            ),
        ));

        // 7. SEO Diagnostics (Scope: seo:read)
        register_rest_route(self::NAMESPACE, '/seo', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_seo_data'),
            'permission_callback' => array($this, 'check_seo_read_permission'),
        ));

        // 8. Auth Rotation / Revocation
        register_rest_route(self::NAMESPACE, '/auth/rotate', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'handle_rotate'),
            'permission_callback' => array($this, 'check_site_read_permission'),
        ));

        register_rest_route(self::NAMESPACE, '/auth/revoke', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array($this, 'handle_revoke'),
            'permission_callback' => array($this, 'check_site_read_permission'),
        ));
    }

    /* ─── Permission Callbacks with Rate Limiting ─── */

    private function validate_common_checks(WP_REST_Request $request, $scope) {
        if (!SEO_Autopilot_Activity::check_rate_limit()) {
            return new WP_Error('seo_autopilot_rate_limited', 'Rate limit exceeded (120 req/min).', array('status' => 429));
        }
        return SEO_Autopilot_Auth::verify_request_key($request, $scope);
    }

    public function check_site_read_permission(WP_REST_Request $request) {
        return $this->validate_common_checks($request, 'site:read');
    }

    public function check_content_read_permission(WP_REST_Request $request) {
        return $this->validate_common_checks($request, 'content:read');
    }

    public function check_content_write_permission(WP_REST_Request $request) {
        return $this->validate_common_checks($request, 'content:write');
    }

    public function check_media_read_permission(WP_REST_Request $request) {
        return $this->validate_common_checks($request, 'media:read');
    }

    public function check_media_write_permission(WP_REST_Request $request) {
        return $this->validate_common_checks($request, 'media:write');
    }

    public function check_seo_read_permission(WP_REST_Request $request) {
        return $this->validate_common_checks($request, 'seo:read');
    }

    /* ─── Endpoint Callbacks ─── */

    public function get_status(WP_REST_Request $request) {
        $is_connected = SEO_Autopilot_Auth::is_connected();
        $conn_info = SEO_Autopilot_Auth::get_connection_info();

        return rest_ensure_response(array(
            'status'         => 'ok',
            'plugin'         => 'SEO Autopilot Agent Connector',
            'version'        => SEO_AUTOPILOT_VERSION,
            'api_version'    => SEO_AUTOPILOT_API_VERSION,
            'is_connected'   => $is_connected,
            'connection_status' => $conn_info['status'],
            'granted_scopes' => $conn_info['scopes'],
            'is_ssl'         => is_ssl(),
            'site_url'       => get_site_url(),
            'wp_version'     => get_bloginfo('version'),
        ));
    }

    public function get_site_info(WP_REST_Request $request) {
        $has_rankmath = defined('RANK_MATH_VERSION') || class_exists('RankMath');
        $has_yoast    = defined('WPSEO_VERSION') || class_exists('WPSEO_Options');
        $has_aioseo   = defined('AIOSEO_VERSION');

        $active_plugin = 'none';
        if ($has_rankmath) $active_plugin = 'rankmath';
        elseif ($has_yoast) $active_plugin = 'yoast';
        elseif ($has_aioseo) $active_plugin = 'aioseo';

        $total_posts = wp_count_posts('post')->publish ?? 0;
        $total_pages = wp_count_posts('page')->publish ?? 0;

        SEO_Autopilot_Activity::log('site.info', 'site', get_current_user_id(), 'Retrieved site info');

        return rest_ensure_response(array(
            'name'           => get_bloginfo('name'),
            'description'    => get_bloginfo('description'),
            'url'            => get_site_url(),
            'home'           => get_home_url(),
            'language'       => get_bloginfo('language'),
            'timezone'       => wp_timezone_string(),
            'wp_version'     => get_bloginfo('version'),
            'php_version'    => phpversion(),
            'seo_plugins'    => array(
                'detected'   => $active_plugin,
                'rank_math'  => $has_rankmath,
                'yoast'      => $has_yoast,
                'aioseo'     => $has_aioseo,
            ),
            'stats'          => array(
                'published_posts' => (int)$total_posts,
                'published_pages' => (int)$total_pages,
            ),
        ));
    }

    public function get_posts(WP_REST_Request $request) {
        $page     = max(1, (int)$request->get_param('page') ?: 1);
        $per_page = min(50, max(1, (int)$request->get_param('per_page') ?: 10));
        $status   = sanitize_text_field($request->get_param('status') ?: 'any');
        $search   = sanitize_text_field($request->get_param('search') ?: '');

        $args = array(
            'post_type'      => 'post',
            'post_status'    => $status === 'any' ? array('publish', 'draft', 'pending') : $status,
            'paged'          => $page,
            'posts_per_page' => $per_page,
            'orderby'        => 'date',
            'order'          => 'DESC',
        );

        if (!empty($search)) {
            $args['s'] = $search;
        }

        $query = new WP_Query($args);
        $posts_data = array();

        foreach ($query->posts as $post) {
            $posts_data[] = $this->format_post_output($post);
        }

        SEO_Autopilot_Activity::log('posts.read', 'post', get_current_user_id(), 'Retrieved ' . count($posts_data) . ' posts');

        $response = rest_ensure_response($posts_data);
        $response->header('X-WP-Total', (int)$query->found_posts);
        $response->header('X-WP-TotalPages', (int)$query->max_num_pages);

        return $response;
    }

    public function get_single_post(WP_REST_Request $request) {
        $post_id = (int)$request['id'];
        $post = get_post($post_id);

        if (!$post || $post->post_type !== 'post') {
            return new WP_Error('seo_autopilot_not_found', 'Post not found', array('status' => 404));
        }

        return rest_ensure_response($this->format_post_output($post));
    }

    public function create_post(WP_REST_Request $request) {
        $params = $request->get_json_params();
        if (empty($params)) {
            $params = $request->get_body_params();
        }

        $title   = sanitize_text_field($params['title'] ?? '');
        $content = wp_kses_post($params['content'] ?? '');
        $excerpt = sanitize_textarea_field($params['excerpt'] ?? '');
        $slug    = sanitize_title($params['slug'] ?? '');
        $status  = sanitize_text_field($params['status'] ?? 'draft');

        if (empty($title) || empty($content)) {
            return new WP_Error('seo_autopilot_invalid_data', 'Title and content are required.', array('status' => 400));
        }

        // Safety: only allow standard statuses
        if (!in_array($status, array('draft', 'pending', 'publish'), true)) {
            $status = 'draft';
        }

        $post_data = array(
            'post_title'    => $title,
            'post_content'  => $content,
            'post_excerpt'  => $excerpt,
            'post_name'     => $slug,
            'post_status'   => $status,
            'post_type'     => 'post',
            'post_author'   => get_current_user_id() ?: 1,
        );

        if (!empty($params['category_ids']) && is_array($params['category_ids'])) {
            $post_data['post_category'] = array_map('intval', $params['category_ids']);
        }

        if (!empty($params['tag_ids']) && is_array($params['tag_ids'])) {
            $post_data['tags_input'] = array_map('intval', $params['tag_ids']);
        }

        $post_id = wp_insert_post($post_data, true);
        if (is_wp_error($post_id)) {
            return $post_id;
        }

        // Handle Featured Image
        if (!empty($params['featured_media'])) {
            set_post_thumbnail($post_id, (int)$params['featured_media']);
        }

        // Handle SEO Metadata for Rank Math, Yoast, or AIOSEO
        $this->save_post_seo_meta($post_id, $params);

        SEO_Autopilot_Activity::log(
            'posts.create',
            'post',
            get_current_user_id(),
            "Created post #{$post_id} '{$title}' ({$status})"
        );

        $created_post = get_post($post_id);
        return rest_ensure_response($this->format_post_output($created_post));
    }

    public function update_post(WP_REST_Request $request) {
        $post_id = (int)$request['id'];
        $post = get_post($post_id);

        if (!$post || $post->post_type !== 'post') {
            return new WP_Error('seo_autopilot_not_found', 'Post not found', array('status' => 404));
        }

        $params = $request->get_json_params() ?: $request->get_body_params();

        $update_data = array('ID' => $post_id);

        if (isset($params['title'])) {
            $update_data['post_title'] = sanitize_text_field($params['title']);
        }
        if (isset($params['content'])) {
            $update_data['post_content'] = wp_kses_post($params['content']);
        }
        if (isset($params['excerpt'])) {
            $update_data['post_excerpt'] = sanitize_textarea_field($params['excerpt']);
        }
        if (isset($params['slug'])) {
            $update_data['post_name'] = sanitize_title($params['slug']);
        }
        if (isset($params['status']) && in_array($params['status'], array('draft', 'pending', 'publish'), true)) {
            $update_data['post_status'] = sanitize_text_field($params['status']);
        }
        if (!empty($params['category_ids']) && is_array($params['category_ids'])) {
            $update_data['post_category'] = array_map('intval', $params['category_ids']);
        }

        $result = wp_update_post($update_data, true);
        if (is_wp_error($result)) {
            return $result;
        }

        if (isset($params['featured_media'])) {
            if (empty($params['featured_media'])) {
                delete_post_thumbnail($post_id);
            } else {
                set_post_thumbnail($post_id, (int)$params['featured_media']);
            }
        }

        $this->save_post_seo_meta($post_id, $params);

        SEO_Autopilot_Activity::log(
            'posts.update',
            'post',
            get_current_user_id(),
            "Updated post #{$post_id}"
        );

        return rest_ensure_response($this->format_post_output(get_post($post_id)));
    }

    public function get_pages(WP_REST_Request $request) {
        $query = new WP_Query(array(
            'post_type'      => 'page',
            'post_status'    => 'publish',
            'posts_per_page' => 50,
            'orderby'        => 'title',
            'order'          => 'ASC',
        ));

        $pages = array();
        foreach ($query->posts as $page) {
            $pages[] = array(
                'id'       => $page->ID,
                'title'    => get_the_title($page),
                'slug'     => $page->post_name,
                'status'   => $page->post_status,
                'link'     => get_permalink($page),
                'date'     => $page->post_date_gmt,
                'modified' => $page->post_modified_gmt,
            );
        }

        return rest_ensure_response($pages);
    }

    public function get_media(WP_REST_Request $request) {
        $query = new WP_Query(array(
            'post_type'      => 'attachment',
            'post_status'    => 'inherit',
            'posts_per_page' => 20,
            'orderby'        => 'date',
            'order'          => 'DESC',
        ));

        $media = array();
        foreach ($query->posts as $att) {
            $media[] = array(
                'id'        => $att->ID,
                'title'     => get_the_title($att),
                'mime_type' => $att->post_mime_type,
                'url'       => wp_get_attachment_url($att->ID),
                'date'      => $att->post_date_gmt,
            );
        }

        return rest_ensure_response($media);
    }

    public function upload_media(WP_REST_Request $request) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';

        $files = $request->get_file_params();
        if (empty($files['file'])) {
            return new WP_Error('seo_autopilot_missing_file', 'No file was uploaded.', array('status' => 400));
        }

        $file = $files['file'];

        // Validate MIME type
        $allowed_types = array('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml');
        $file_type = wp_check_filetype($file['name']);

        if (!in_array($file_type['type'], $allowed_types, true)) {
            return new WP_Error('seo_autopilot_invalid_mime', 'Unsupported file type. Only JPEG, PNG, WebP, GIF, and SVG are supported.', array('status' => 400));
        }

        $alt_text = sanitize_text_field($request->get_param('alt_text') ?: '');
        $title    = sanitize_text_field($request->get_param('title') ?: sanitize_file_name($file['name']));

        $attachment_id = media_handle_upload('file', 0, array(
            'post_title' => $title,
        ));

        if (is_wp_error($attachment_id)) {
            return $attachment_id;
        }

        if (!empty($alt_text)) {
            update_post_meta($attachment_id, '_wp_attachment_image_alt', $alt_text);
        }

        SEO_Autopilot_Activity::log(
            'media.upload',
            'attachment',
            get_current_user_id(),
            "Uploaded media #{$attachment_id} '{$title}'"
        );

        return rest_ensure_response(array(
            'id'        => $attachment_id,
            'title'     => $title,
            'url'       => wp_get_attachment_url($attachment_id),
            'alt_text'  => $alt_text,
            'mime_type' => $file_type['type'],
        ));
    }

    public function get_seo_data(WP_REST_Request $request) {
        return rest_ensure_response(array(
            'has_rank_math' => class_exists('RankMath'),
            'has_yoast'     => class_exists('WPSEO_Options'),
            'has_aioseo'    => defined('AIOSEO_VERSION'),
            'sitemap_url'   => home_url('/sitemap_index.xml'),
            'robots_txt'    => home_url('/robots.txt'),
        ));
    }

    public function handle_rotate(WP_REST_Request $request) {
        $new_creds = SEO_Autopilot_Auth::rotate_api_key();
        return rest_ensure_response(array(
            'status'     => 'rotated',
            'api_key'    => $new_creds['raw_key'],
            'prefix'     => $new_creds['prefix'],
            'created_at' => $new_creds['created_at'],
        ));
    }

    public function handle_revoke(WP_REST_Request $request) {
        SEO_Autopilot_Auth::revoke_api_key();
        return rest_ensure_response(array('status' => 'revoked'));
    }

    /* ─── Helpers ─── */

    private function format_post_output($post) {
        $seo_meta = $this->get_post_seo_meta($post->ID);

        return array(
            'id'             => $post->ID,
            'title'          => array('rendered' => get_the_title($post)),
            'content'        => array('rendered' => apply_filters('the_content', $post->post_content), 'raw' => $post->post_content),
            'excerpt'        => array('rendered' => get_the_excerpt($post)),
            'slug'           => $post->post_name,
            'status'         => $post->post_status,
            'link'           => get_permalink($post),
            'date'           => $post->post_date_gmt,
            'modified'       => $post->post_modified_gmt,
            'featured_media' => (int)get_post_thumbnail_id($post->ID),
            'categories'     => wp_get_post_categories($post->ID),
            'tags'           => wp_get_post_tags($post->ID, array('fields' => 'ids')),
            'seo'            => $seo_meta,
        );
    }

    private function get_post_seo_meta($post_id) {
        return array(
            'seo_title'        => get_post_meta($post_id, 'rank_math_title', true) ?: get_post_meta($post_id, '_yoast_wpseo_title', true),
            'meta_description' => get_post_meta($post_id, 'rank_math_description', true) ?: get_post_meta($post_id, '_yoast_wpseo_metadesc', true),
            'canonical_url'    => get_post_meta($post_id, 'rank_math_canonical_url', true) ?: get_post_meta($post_id, '_yoast_wpseo_canonical', true),
        );
    }

    private function save_post_seo_meta($post_id, $params) {
        if (!empty($params['seo_title'])) {
            $seo_title = sanitize_text_field($params['seo_title']);
            update_post_meta($post_id, 'rank_math_title', $seo_title);
            update_post_meta($post_id, '_yoast_wpseo_title', $seo_title);
            update_post_meta($post_id, '_aioseo_title', $seo_title);
        }

        if (!empty($params['meta_description'])) {
            $desc = sanitize_textarea_field($params['meta_description']);
            update_post_meta($post_id, 'rank_math_description', $desc);
            update_post_meta($post_id, '_yoast_wpseo_metadesc', $desc);
            update_post_meta($post_id, '_aioseo_description', $desc);
        }

        if (!empty($params['canonical_url'])) {
            $canonical = esc_url_raw($params['canonical_url']);
            update_post_meta($post_id, 'rank_math_canonical_url', $canonical);
            update_post_meta($post_id, '_yoast_wpseo_canonical', $canonical);
        }
    }
}
