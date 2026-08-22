<?php
/**
 * Safe Outbound Job Worker Subsystem
 *
 * Enforces a strict allowlist of WordPress SEO operations.
 * Never executes raw PHP, arbitrary SQL, or unsafe commands.
 *
 * @package SEO_Autopilot_Connector
 */

if (!defined('ABSPATH')) {
    exit;
}

class SEO_Autopilot_Worker {

    /**
     * Allowed job operations
     */
    private static $allowed_operations = array(
        'sync_site_info',
        'create_post',
        'update_post',
        'update_seo_meta',
        'upload_media',
        'get_post',
        'list_posts',
        'list_pages',
        'add_internal_links',
    );

    /**
     * Execute a claimed job with idempotency and capability checks
     */
    public static function execute_job($job) {
        $job_id   = sanitize_text_field($job['id'] ?? '');
        $job_type = sanitize_key($job['job_type'] ?? '');
        $payload  = $job['payload'] ?? array();

        if (empty($job_id) || empty($job_type)) {
            return array(
                'status' => 'failed',
                'error'  => array('code' => 'invalid_job', 'message' => 'Job ID and job_type are required.'),
            );
        }

        // 1. Strict Allowlist Check
        if (!in_array($job_type, self::$allowed_operations, true)) {
            SEO_Autopilot_Activity::log('worker.rejected', 'job', 0, "Rejected disallowed job type: {$job_type}", 403);
            return array(
                'status' => 'failed',
                'error'  => array('code' => 'unauthorized_operation', 'message' => "Operation '{$job_type}' is not allowed."),
            );
        }

        // 2. Idempotency Check (prevent duplicate execution)
        $idempotency_key = 'seo_ap_job_done_' . md5($job_id);
        $cached_result = get_transient($idempotency_key);
        if ($cached_result !== false) {
            return array(
                'status' => 'success',
                'result' => $cached_result,
            );
        }

        // 3. Set Execution User Context
        $user_id = (int)get_option(SEO_Autopilot_Auth::OPTION_USER_ID, 1);
        if ($user_id > 0) {
            wp_set_current_user($user_id);
        }

        SEO_Autopilot_Activity::log('worker.execute', 'job', $user_id, "Executing job #{$job_id} ({$job_type})");

        try {
            $result = null;
            switch ($job_type) {
                case 'sync_site_info':
                    $result = self::op_sync_site_info($payload);
                    break;
                case 'create_post':
                    $result = self::op_create_post($payload);
                    break;
                case 'update_post':
                    $result = self::op_update_post($payload);
                    break;
                case 'update_seo_meta':
                    $result = self::op_update_seo_meta($payload);
                    break;
                case 'upload_media':
                    $result = self::op_upload_media($payload);
                    break;
                case 'get_post':
                    $result = self::op_get_post($payload);
                    break;
                case 'list_posts':
                    $result = self::op_list_posts($payload);
                    break;
                case 'list_pages':
                    $result = self::op_list_pages($payload);
                    break;
                case 'add_internal_links':
                    $result = self::op_add_internal_links($payload);
                    break;
            }

            // Cache result for 24 hours for idempotency
            set_transient($idempotency_key, $result, DAY_IN_SECONDS);

            return array(
                'status' => 'success',
                'result' => $result,
            );
        } catch (Exception $e) {
            SEO_Autopilot_Activity::log('worker.error', 'job', $user_id, "Job #{$job_id} failed: " . $e->getMessage(), 500);
            return array(
                'status' => 'failed',
                'error'  => array('code' => 'execution_exception', 'message' => $e->getMessage()),
            );
        }
    }

    /* ─── Allowed Safe Operations ─── */

    private static function op_sync_site_info($payload) {
        $has_rankmath = defined('RANK_MATH_VERSION') || class_exists('RankMath');
        $has_yoast    = defined('WPSEO_VERSION') || class_exists('WPSEO_Options');
        $has_aioseo   = defined('AIOSEO_VERSION');

        return array(
            'site_name'        => get_bloginfo('name'),
            'site_url'         => get_site_url(),
            'wp_version'       => get_bloginfo('version'),
            'php_version'      => phpversion(),
            'published_posts'  => (int)(wp_count_posts('post')->publish ?? 0),
            'published_pages'  => (int)(wp_count_posts('page')->publish ?? 0),
            'rank_math'        => $has_rankmath,
            'yoast'            => $has_yoast,
            'aioseo'           => $has_aioseo,
        );
    }

    private static function op_create_post($payload) {
        $title   = sanitize_text_field($payload['title'] ?? '');
        $content = wp_kses_post($payload['content'] ?? '');
        $excerpt = sanitize_textarea_field($payload['excerpt'] ?? '');
        $slug    = sanitize_title($payload['slug'] ?? '');
        $status  = sanitize_text_field($payload['status'] ?? 'draft');

        if (empty($title) || empty($content)) {
            throw new Exception('Title and content are required to create a post.');
        }

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

        if (!empty($payload['category_ids']) && is_array($payload['category_ids'])) {
            $post_data['post_category'] = array_map('intval', $payload['category_ids']);
        }

        if (!empty($payload['tag_ids']) && is_array($payload['tag_ids'])) {
            $post_data['tags_input'] = array_map('intval', $payload['tag_ids']);
        }

        $post_id = wp_insert_post($post_data, true);
        if (is_wp_error($post_id)) {
            throw new Exception($post_id->get_error_message());
        }

        // Set Featured Image
        if (!empty($payload['featured_media'])) {
            set_post_thumbnail($post_id, (int)$payload['featured_media']);
        }

        // Save SEO Meta
        self::save_seo_meta($post_id, $payload);

        return array(
            'post_id'   => $post_id,
            'title'     => $title,
            'slug'      => get_post_field('post_name', $post_id),
            'status'    => $status,
            'permalink' => get_permalink($post_id),
        );
    }

    private static function op_update_post($payload) {
        $post_id = (int)($payload['post_id'] ?? $payload['id'] ?? 0);
        if (!$post_id || !get_post($post_id)) {
            throw new Exception("Post #{$post_id} not found.");
        }

        $update_data = array('ID' => $post_id);

        if (isset($payload['title'])) {
            $update_data['post_title'] = sanitize_text_field($payload['title']);
        }
        if (isset($payload['content'])) {
            $update_data['post_content'] = wp_kses_post($payload['content']);
        }
        if (isset($payload['excerpt'])) {
            $update_data['post_excerpt'] = sanitize_textarea_field($payload['excerpt']);
        }
        if (isset($payload['slug'])) {
            $update_data['post_name'] = sanitize_title($payload['slug']);
        }
        if (isset($payload['status']) && in_array($payload['status'], array('draft', 'pending', 'publish'), true)) {
            $update_data['post_status'] = sanitize_text_field($payload['status']);
        }

        $result = wp_update_post($update_data, true);
        if (is_wp_error($result)) {
            throw new Exception($result->get_error_message());
        }

        if (isset($payload['featured_media'])) {
            if (empty($payload['featured_media'])) {
                delete_post_thumbnail($post_id);
            } else {
                set_post_thumbnail($post_id, (int)$payload['featured_media']);
            }
        }

        self::save_seo_meta($post_id, $payload);

        return array(
            'post_id'   => $post_id,
            'title'     => get_the_title($post_id),
            'status'    => get_post_status($post_id),
            'permalink' => get_permalink($post_id),
        );
    }

    private static function op_update_seo_meta($payload) {
        $post_id = (int)($payload['post_id'] ?? $payload['id'] ?? 0);
        if (!$post_id || !get_post($post_id)) {
            throw new Exception("Post #{$post_id} not found.");
        }

        self::save_seo_meta($post_id, $payload);

        return array(
            'post_id'          => $post_id,
            'seo_title'        => $payload['seo_title'] ?? '',
            'meta_description' => $payload['meta_description'] ?? '',
            'canonical_url'    => $payload['canonical_url'] ?? '',
        );
    }

    private static function op_upload_media($payload) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';

        $image_url = esc_url_raw($payload['image_url'] ?? $payload['url'] ?? '');
        $alt_text  = sanitize_text_field($payload['alt_text'] ?? '');
        $title     = sanitize_text_field($payload['title'] ?? '');

        if (empty($image_url)) {
            throw new Exception('image_url is required for media upload.');
        }

        // Secure Sideload from verified URL
        $attachment_id = media_sideload_image($image_url, 0, $title, 'id');
        if (is_wp_error($attachment_id)) {
            throw new Exception('Media sideload failed: ' . $attachment_id->get_error_message());
        }

        if (!empty($alt_text)) {
            update_post_meta($attachment_id, '_wp_attachment_image_alt', $alt_text);
        }

        return array(
            'attachment_id' => $attachment_id,
            'url'           => wp_get_attachment_url($attachment_id),
            'alt_text'      => $alt_text,
            'title'         => $title,
        );
    }

    private static function op_get_post($payload) {
        $post_id = (int)($payload['post_id'] ?? $payload['id'] ?? 0);
        $post = get_post($post_id);
        if (!$post) {
            throw new Exception("Post #{$post_id} not found.");
        }

        return array(
            'id'        => $post->ID,
            'title'     => get_the_title($post),
            'content'   => $post->post_content,
            'excerpt'   => get_the_excerpt($post),
            'slug'      => $post->post_name,
            'status'    => $post->post_status,
            'permalink' => get_permalink($post),
        );
    }

    private static function op_list_posts($payload) {
        $limit = min(50, max(1, (int)($payload['limit'] ?? 10)));
        $posts = get_posts(array(
            'numberposts' => $limit,
            'post_status' => 'any',
            'orderby'     => 'date',
            'order'       => 'DESC',
        ));

        $output = array();
        foreach ($posts as $p) {
            $output[] = array(
                'id'        => $p->ID,
                'title'     => get_the_title($p),
                'status'    => $p->post_status,
                'permalink' => get_permalink($p),
                'date'      => $p->post_date_gmt,
            );
        }
        return $output;
    }

    private static function op_list_pages($payload) {
        $pages = get_pages(array('number' => 50, 'post_status' => 'publish'));
        $output = array();
        foreach ($pages as $p) {
            $output[] = array(
                'id'        => $p->ID,
                'title'     => get_the_title($p),
                'slug'      => $p->post_name,
                'permalink' => get_permalink($p),
            );
        }
        return $output;
    }

    private static function op_add_internal_links($payload) {
        $post_id = (int)($payload['post_id'] ?? 0);
        $links   = $payload['links'] ?? array(); // array of { anchor, target_url }

        $post = get_post($post_id);
        if (!$post) {
            throw new Exception("Post #{$post_id} not found.");
        }

        $content = $post->post_content;
        $modified_count = 0;

        foreach ($links as $link_item) {
            $anchor = sanitize_text_field($link_item['anchor'] ?? '');
            $target = esc_url_raw($link_item['target_url'] ?? '');

            if (!empty($anchor) && !empty($target)) {
                // Replace first occurrence not already inside a tag
                $pattern = '/(?!(?:[^<]+>|[^>]+<\/a>))\b(' . preg_quote($anchor, '/') . ')\b/i';
                $replacement = '<a href="' . esc_url($target) . '">$1</a>';
                $new_content = preg_replace($pattern, $replacement, $content, 1);
                if ($new_content && $new_content !== $content) {
                    $content = $new_content;
                    $modified_count++;
                }
            }
        }

        if ($modified_count > 0) {
            wp_update_post(array(
                'ID'           => $post_id,
                'post_content' => $content,
            ));
        }

        return array(
            'post_id'         => $post_id,
            'links_inserted'  => $modified_count,
            'permalink'       => get_permalink($post_id),
        );
    }

    private static function save_seo_meta($post_id, $params) {
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
