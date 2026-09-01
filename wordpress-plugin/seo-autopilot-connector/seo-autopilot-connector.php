<?php
/**
 * Plugin Name:       SEO Autopilot Agent Connector
 * Plugin URI:        https://seautopilot.io
 * Description:       Official secure agent connector for SEO Autopilot SaaS. Enables autonomous SEO optimization, draft publishing, media uploads, and audit telemetry via outbound reverse-connection architecture without sharing passwords or requiring inbound access.
 * Version:           1.2.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            SEO Autopilot Team
 * Author URI:        https://seautopilot.io
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       seo-autopilot-connector
 * Domain Path:       /languages
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly.
}

define('SEO_AUTOPILOT_VERSION', '1.2.0');
define('SEO_AUTOPILOT_API_VERSION', 'v1');
define('SEO_AUTOPILOT_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SEO_AUTOPILOT_PLUGIN_URL', plugin_dir_url(__FILE__));
define('SEO_AUTOPILOT_PLUGIN_BASENAME', plugin_basename(__FILE__));

// Guard minimum PHP version safely
if (version_compare(PHP_VERSION, '7.4', '<')) {
    add_action('admin_notices', function() {
        echo '<div class="notice notice-error"><p><strong>SEO Autopilot Connector:</strong> Requires PHP 7.4 or higher. Your server is running PHP ' . esc_html(PHP_VERSION) . '.</p></div>';
    });
    return;
}

// ==========================================
// UNIFIED CORE SUBSYSTEM CLASSES
// ==========================================

/* --- BEGIN class-seo-autopilot-activity.php --- */
/**
 * Activity Log and Rate Limiting Subsystem
 *
 * @package SEO_Autopilot_Connector
 */



class SEO_Autopilot_Activity {

    private static $instance = null;
    const TABLE_NAME = 'seo_autopilot_activity_logs';

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {}

    /**
     * Create Activity Log Table
     */
    public static function init_db() {
        global $wpdb;
        $table_name = $wpdb->prefix . self::TABLE_NAME;
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS {$table_name} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            created_at datetime NOT NULL,
            event_type varchar(64) NOT NULL,
            target_type varchar(64) NOT NULL,
            user_id bigint(20) unsigned NOT NULL DEFAULT 0,
            message text NOT NULL,
            http_status int(4) NOT NULL DEFAULT 200,
            ip_address varchar(45) NOT NULL DEFAULT '',
            PRIMARY KEY (id),
            KEY created_at (created_at),
            KEY event_type (event_type)
        ) {$charset_collate};";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
    }

    /**
     * Log an activity event safely (never log raw secrets or tokens)
     */
    public static function log($event_type, $target_type, $user_id, $message, $http_status = 200) {
        try {
            global $wpdb;
            $table_name = $wpdb->prefix . self::TABLE_NAME;

            $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
            $sanitized_message = wp_strip_all_tags($message);

            // Sanitize out any accidental token appearances
            $sanitized_message = preg_replace('/seo_live_[a-f0-9]{48}/i', 'seo_live_***', $sanitized_message);
            $sanitized_message = preg_replace('/Bearer\s+[a-zA-Z0-9_\-\.]+/i', 'Bearer ***', $sanitized_message);

            $inserted = $wpdb->insert(
                $table_name,
                array(
                    'created_at'  => current_time('mysql', 1),
                    'event_type'  => sanitize_key($event_type),
                    'target_type' => sanitize_key($target_type),
                    'user_id'     => (int)$user_id,
                    'message'     => $sanitized_message,
                    'http_status' => (int)$http_status,
                    'ip_address'  => $ip,
                ),
                array('%s', '%s', '%s', '%d', '%s', '%d', '%s')
            );

            // Keep table capped under 500 rows to prevent DB bloat
            if ($inserted && mt_rand(1, 100) === 1) {
                $wpdb->query("DELETE FROM {$table_name} WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
            }
        } catch (\Throwable $e) {
            error_log('[SEO Autopilot Activity] Log failed: ' . $e->getMessage());
        }
    }

    /**
     * Check rate limiting (120 requests per minute by default)
     */
    public static function check_rate_limit($ip = null, $limit = 120, $window = 60) {
        if (empty($ip)) {
            $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
        }

        $transient_key = 'seo_ap_rate_' . md5($ip);
        $current = (int)get_transient($transient_key);

        if ($current >= $limit) {
            return false;
        }

        set_transient($transient_key, $current + 1, $window);
        return true;
    }

    /**
     * Retrieve recent logs for admin dashboard
     */
    public static function get_recent_logs($limit = 30) {
        global $wpdb;
        $table_name = $wpdb->prefix . self::TABLE_NAME;

        if ($wpdb->get_var("SHOW TABLES LIKE '{$table_name}'") !== $table_name) {
            return array();
        }

        $limit = (int)$limit;
        return $wpdb->get_results(
            $wpdb->prepare("SELECT * FROM {$table_name} ORDER BY id DESC LIMIT %d", $limit),
            ARRAY_A
        );
    }
}
/* --- END class-seo-autopilot-activity.php --- */

/* --- BEGIN class-seo-autopilot-auth.php --- */
/**
 * Authentication and Key Management Subsystem
 *
 * @package SEO_Autopilot_Connector
 */



class SEO_Autopilot_Auth {

    private static $instance = null;

    const OPTION_KEY_HASH   = 'seo_autopilot_key_hash';
    const OPTION_KEY_PREFIX = 'seo_autopilot_key_prefix';
    const OPTION_SCOPES     = 'seo_autopilot_scopes';
    const OPTION_STATUS     = 'seo_autopilot_status';
    const OPTION_CREATED_AT = 'seo_autopilot_created_at';
    const OPTION_LAST_USED  = 'seo_autopilot_last_used';
    const OPTION_USER_ID    = 'seo_autopilot_user_id';
    const OPTION_NONCE_MAP  = 'seo_autopilot_connect_nonces';

    public static $available_scopes = array(
        'site:read'      => 'Read site information and health diagnostics',
        'content:read'   => 'Read posts, pages, categories, and taxonomies',
        'content:write'  => 'Create and update draft/published posts and pages',
        'media:read'     => 'Read media library attachments',
        'media:write'    => 'Upload images and optimize media assets',
        'seo:read'       => 'Read SEO metadata (Yoast, Rank Math, AIOSEO)',
    );

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {}

    public static function init_db() {
        if (!get_option(self::OPTION_STATUS)) {
            update_option(self::OPTION_STATUS, 'unconfigured');
        }
    }

    /**
     * Generate a new cryptographically secure API Key
     * Format: seo_live_<48-hex-chars>
     */
    public static function generate_api_key($user_id = 0, $scopes = null) {
        if (empty($scopes)) {
            $scopes = array_keys(self::$available_scopes);
        }

        if (empty($user_id)) {
            $user_id = get_current_user_id();
            if (!$user_id) {
                // Fallback to first administrator
                $admins = get_users(array('role' => 'administrator', 'number' => 1));
                $user_id = !empty($admins) ? $admins[0]->ID : 1;
            }
        }

        $random_bytes = bin2hex(random_bytes(24));
        $raw_key = 'seo_live_' . $random_bytes;
        $key_prefix = substr($raw_key, 0, 14) . '...';
        $key_hash = hash_hmac('sha256', $raw_key, wp_salt('auth'));

        update_option(self::OPTION_KEY_HASH, $key_hash);
        update_option(self::OPTION_KEY_PREFIX, $key_prefix);
        update_option(self::OPTION_SCOPES, $scopes);
        update_option(self::OPTION_STATUS, 'active');
        update_option(self::OPTION_CREATED_AT, current_time('mysql', 1));
        update_option(self::OPTION_USER_ID, (int)$user_id);

        SEO_Autopilot_Activity::log(
            'auth.generate',
            'api_key',
            $user_id,
            'Generated new API credentials with ' . count($scopes) . ' scopes'
        );

        return array(
            'raw_key'    => $raw_key,
            'prefix'     => $key_prefix,
            'scopes'     => $scopes,
            'created_at' => current_time('mysql', 1),
            'user_id'    => (int)$user_id,
        );
    }

    /**
     * Rotate current API key
     */
    public static function rotate_api_key() {
        $user_id = (int)get_option(self::OPTION_USER_ID, 1);
        $scopes  = get_option(self::OPTION_SCOPES, array_keys(self::$available_scopes));

        $new_creds = self::generate_api_key($user_id, $scopes);
        SEO_Autopilot_Activity::log(
            'auth.rotate',
            'api_key',
            $user_id,
            'Rotated API credential key'
        );
        return $new_creds;
    }

    /**
     * Revoke current API key
     */
    public static function revoke_api_key() {
        delete_option(self::OPTION_KEY_HASH);
        delete_option(self::OPTION_KEY_PREFIX);
        update_option(self::OPTION_STATUS, 'revoked');

        SEO_Autopilot_Activity::log(
            'auth.revoke',
            'api_key',
            get_current_user_id(),
            'Revoked active API credentials'
        );

        return true;
    }

    /**
     * Verify incoming request credentials
     */
    public static function verify_request_key(WP_REST_Request $request, $required_scope = null) {
        $raw_key = self::extract_key_from_request($request);

        if (empty($raw_key)) {
            return new WP_Error(
                'seo_autopilot_missing_key',
                'Missing API authentication credential. Provide X-SEO-Autopilot-Key or Authorization Bearer header.',
                array('status' => 401)
            );
        }

        $status = get_option(self::OPTION_STATUS, 'unconfigured');
        if ($status !== 'active') {
            return new WP_Error(
                'seo_autopilot_inactive_key',
                'SEO Autopilot API key is revoked or unconfigured.',
                array('status' => 401)
            );
        }

        $stored_hash = get_option(self::OPTION_KEY_HASH);
        if (empty($stored_hash)) {
            return new WP_Error(
                'seo_autopilot_not_configured',
                'No API key is configured on this WordPress site.',
                array('status' => 401)
            );
        }

        $computed_hash = hash_hmac('sha256', $raw_key, wp_salt('auth'));
        if (!hash_equals($stored_hash, $computed_hash)) {
            SEO_Autopilot_Activity::log(
                'auth.failed',
                'request',
                0,
                'Invalid API key rejected from ' . sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? 'unknown'),
                401
            );

            return new WP_Error(
                'seo_autopilot_invalid_key',
                'Invalid API key credential.',
                array('status' => 401)
            );
        }

        // Scope check
        if (!empty($required_scope)) {
            $granted_scopes = get_option(self::OPTION_SCOPES, array());
            if (!in_array($required_scope, $granted_scopes, true)) {
                return new WP_Error(
                    'seo_autopilot_insufficient_scope',
                    sprintf('This credential lacks the required scope: %s', esc_html($required_scope)),
                    array('status' => 403)
                );
            }
        }

        // Update last used timestamp
        update_option(self::OPTION_LAST_USED, current_time('mysql', 1));

        // Switch execution context to designated WordPress user
        $user_id = (int)get_option(self::OPTION_USER_ID, 1);
        if ($user_id > 0) {
            wp_set_current_user($user_id);
        }

        return true;
    }

    /**
     * Extract key from Request Headers or Query Parameters (Fail-safe across all Apache/Nginx/Hostinger setups)
     */
    private static function extract_key_from_request(WP_REST_Request $request) {
        // 1. Check custom header
        $custom_header = $request->get_header('x-seo-autopilot-key');
        if (!empty($custom_header)) {
            return trim($custom_header);
        }

        // 2. Check $_SERVER for stripped custom header in FastCGI
        if (!empty($_SERVER['HTTP_X_SEO_AUTOPILOT_KEY'])) {
            return trim($_SERVER['HTTP_X_SEO_AUTOPILOT_KEY']);
        }

        // 3. Check standard Authorization Bearer header
        $auth_header = $request->get_header('authorization');
        if (empty($auth_header)) {
            $auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        }
        if (!empty($auth_header) && preg_match('/Bearer\s+(\S+)/i', $auth_header, $matches)) {
            return trim($matches[1]);
        }

        // 4. Check query / body parameter fallback
        $query_key = $request->get_param('seo_api_key');
        if (empty($query_key)) {
            $query_key = $_GET['seo_api_key'] ?? $_POST['seo_api_key'] ?? '';
        }
        if (!empty($query_key)) {
            return trim($query_key);
        }

        return null;
    }

    /**
     * Check if currently connected
     */
    public static function is_connected() {
        $status = get_option(self::OPTION_STATUS);
        $hash   = get_option(self::OPTION_KEY_HASH);
        return $status === 'active' && !empty($hash);
    }

    /**
     * Get Connection Metadata
     */
    public static function get_connection_info() {
        return array(
            'is_connected' => self::is_connected(),
            'status'       => get_option(self::OPTION_STATUS, 'unconfigured'),
            'prefix'       => get_option(self::OPTION_KEY_PREFIX, ''),
            'scopes'       => get_option(self::OPTION_SCOPES, array()),
            'created_at'   => get_option(self::OPTION_CREATED_AT, ''),
            'last_used'    => get_option(self::OPTION_LAST_USED, ''),
            'user_id'      => (int)get_option(self::OPTION_USER_ID, 1),
        );
    }
}
/* --- END class-seo-autopilot-auth.php --- */

/* --- BEGIN class-seo-autopilot-worker.php --- */
class SEO_Autopilot_Worker {

    public static function execute_job($job) {
        try {
            $result = self::process_job($job);
            return array(
                'status' => 'completed',
                'result' => $result,
            );
        } catch (\Throwable $e) {
            error_log('[SEO Autopilot Worker] Job execution failed: ' . $e->getMessage());
            return array(
                'status' => 'failed',
                'error'  => $e->getMessage(),
            );
        }
    }

    public static function process_job($job) {
        if (empty($job['job_type'])) {
            throw new Exception('Missing job_type');
        }

        switch ($job['job_type']) {
            case 'create_post':
                return self::op_create_post($job['payload'] ?? array());
            case 'update_post':
                return self::op_update_post($job['payload'] ?? array());
            case 'upload_media':
                return self::op_upload_media($job['payload'] ?? array());
            case 'update_metadata':
                return self::op_update_metadata($job['payload'] ?? array());
            case 'add_internal_link':
                return self::op_add_internal_link($job['payload'] ?? array());
            default:
                throw new Exception("Unknown job_type: {$job['job_type']}");
        }
    }

    private static function save_seo_meta($post_id, $payload) {
        if (!function_exists('is_plugin_active')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $seo_title = sanitize_text_field($payload['seo_title'] ?? '');
        $meta_desc = sanitize_textarea_field($payload['meta_description'] ?? '');

        // Yoast SEO
        if (defined('WPSEO_VERSION') || (function_exists('is_plugin_active') && is_plugin_active('wordpress-seo/wp-seo.php'))) {
            if ($seo_title) update_post_meta($post_id, '_yoast_wpseo_title', $seo_title);
            if ($meta_desc) update_post_meta($post_id, '_yoast_wpseo_metadesc', $meta_desc);
        }

        // Rank Math
        if (defined('RANK_MATH_VERSION') || class_exists('RankMath') || (function_exists('is_plugin_active') && is_plugin_active('seo-by-rank-math/rank-math.php'))) {
            if ($seo_title) update_post_meta($post_id, 'rank_math_title', $seo_title);
            if ($meta_desc) update_post_meta($post_id, 'rank_math_description', $meta_desc);
        }

        // All in One SEO
        if (defined('AIOSEO_VERSION') || (function_exists('is_plugin_active') && is_plugin_active('all-in-one-seo-pack/all_in_one_seo_pack.php'))) {
            if ($seo_title) update_post_meta($post_id, '_aioseo_title', $seo_title);
            if ($meta_desc) update_post_meta($post_id, '_aioseo_description', $meta_desc);
        }
    }

    private static function upload_base64_safely($base64_data, $ext) {
        $decoded = base64_decode($base64_data);
        if (!$decoded) return false;
        
        $filename = 'ai-image-' . substr(md5(uniqid()), 0, 8) . '.' . ($ext === 'jpeg' ? 'jpg' : $ext);
        $upload = wp_upload_bits($filename, null, $decoded);
        
        if (empty($upload['error']) && !empty($upload['url'])) {
            $file_path = $upload['file'];
            $wp_filetype = wp_check_filetype($filename, null);
            $attachment = array(
                'post_mime_type' => $wp_filetype['type'],
                'post_title'     => sanitize_file_name($filename),
                'post_content'   => '',
                'post_status'    => 'inherit'
            );
            $attach_id = wp_insert_attachment($attachment, $file_path);
            if (!function_exists('wp_generate_attachment_metadata')) {
                require_once(ABSPATH . 'wp-admin/includes/image.php');
            }
            if ($attach_id && !is_wp_error($attach_id)) {
                $attach_data = wp_generate_attachment_metadata($attach_id, $file_path);
                wp_update_attachment_metadata($attach_id, $attach_data);
            }
            return $upload['url'];
        }
        return false;
    }

    public static function format_content_for_wp($content) {
        if (empty($content)) return $content;

        // 1. Process HTML image tags safely without crashing PCRE
        $offset = 0;
        while (($pos = strpos($content, 'src="data:image/', $offset)) !== false) {
            $end_pos = strpos($content, '"', $pos + 16);
            if ($end_pos === false) break;
            
            $full_match = substr($content, $pos, $end_pos - $pos + 1); 
            $data_uri = substr($full_match, 5, -1); 
            
            $semicolon = strpos($data_uri, ';base64,');
            if ($semicolon !== false) {
                $ext = substr($data_uri, 11, $semicolon - 11);
                $base64 = substr($data_uri, $semicolon + 8);
                $url = self::upload_base64_safely($base64, $ext);
                if ($url) {
                    $new_src = 'src="' . esc_url($url) . '"';
                    $content = str_replace($full_match, $new_src, $content);
                    $offset = $pos + strlen($new_src);
                    continue;
                }
            }
            $offset = $end_pos;
        }

        // 2. Process Markdown image tags safely
        $offset = 0;
        while (($pos = strpos($content, '](data:image/', $offset)) !== false) {
            $start_markdown = strrpos(substr($content, 0, $pos), '![');
            if ($start_markdown === false) {
                $offset = $pos + 13;
                continue;
            }
            $end_pos = strpos($content, ')', $pos + 13);
            if ($end_pos === false) break;
            
            $full_match = substr($content, $start_markdown, $end_pos - $start_markdown + 1); 
            
            // Extract alt
            $alt_start = $start_markdown + 2;
            $alt_end = strpos($content, ']', $alt_start);
            $alt = substr($content, $alt_start, $alt_end - $alt_start);
            
            $data_uri = substr($content, $pos + 2, $end_pos - ($pos + 2));
            $semicolon = strpos($data_uri, ';base64,');
            
            if ($semicolon !== false) {
                $ext = substr($data_uri, 11, $semicolon - 11);
                $base64 = substr($data_uri, $semicolon + 8);
                
                $url = self::upload_base64_safely($base64, $ext);
                if ($url) {
                    $replacement = "

<!-- wp:image {"sizeSlug":"large"} -->
<figure class="wp-block-image size-large"><img src="$url" alt="$alt" class="wp-image" style="border-radius:12px;margin:24px 0;max-width:100%;height:auto;"/><figcaption class="wp-element-caption">$alt</figcaption></figure>
<!-- /wp:image -->

";
                    $content = str_replace($full_match, $replacement, $content);
                    $offset = $start_markdown + strlen($replacement);
                    continue;
                }
            }
            $offset = $end_pos;
        }

        // Convert standard Markdown Images to Gutenberg
        $content = preg_replace_callback('/![([^]]*)](([^)]+))/', function($matches) {
            $alt = $matches[1];
            $src = $matches[2];
            return "

<!-- wp:image {"sizeSlug":"large"} -->
<figure class="wp-block-image size-large"><img src="$src" alt="$alt" class="wp-image" style="border-radius:12px;margin:24px 0;max-width:100%;height:auto;"/><figcaption class="wp-element-caption">$alt</figcaption></figure>
<!-- /wp:image -->

";
        }, $content);

        // Convert Headings
        $content = preg_replace('/^###s+(.+)$/m', "

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">$1</h3>
<!-- /wp:heading -->

", $content);
        $content = preg_replace('/^##s+(.+)$/m', "

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">$1</h2>
<!-- /wp:heading -->

", $content);
        $content = preg_replace('/^#s+(.+)$/m', "

<!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">$1</h1>
<!-- /wp:heading -->

", $content);

        // Convert Bold & Italic
        $content = preg_replace('/**([^*]+)**/', '<strong>$1</strong>', $content);
        $content = preg_replace('/*([^*]+)*/', '<em>$1</em>', $content);

        // Convert Paragraphs
        $paragraphs = preg_split('/
s*
/', $content);
        $formatted = array();
        foreach ($paragraphs as $p) {
            $p = trim($p);
            if (empty($p)) continue;
            if (strpos($p, '<!-- wp:') === 0 || strpos($p, '<h') === 0 || strpos($p, '<figure') === 0) {
                $formatted[] = $p;
            } else {
                $formatted[] = "<!-- wp:paragraph -->
<p>" . nl2br($p) . "</p>
<!-- /wp:paragraph -->";
            }
        }

        return implode("

", $formatted);
    }

    private static function op_create_post($payload) {
        $title   = sanitize_text_field($payload['title'] ?? '');
        $raw_content = $payload['content'] ?? '';
        $content = self::format_content_for_wp($raw_content);
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

        if (!empty($payload['featured_media'])) {
            set_post_thumbnail($post_id, (int)$payload['featured_media']);
        }

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
            $update_data['post_content'] = self::format_content_for_wp($payload['content']);
        }
        if (isset($payload['excerpt'])) {
            $update_data['post_excerpt'] = sanitize_textarea_field($payload['excerpt']);
        }
        if (isset($payload['slug'])) {
            $update_data['post_name'] = sanitize_title($payload['slug']);
        }
        if (isset($payload['status']) && in_array($payload['status'], array('draft', 'pending', 'publish'))) {
            $update_data['post_status'] = $payload['status'];
        }
        if (isset($payload['category_ids']) && is_array($payload['category_ids'])) {
            $update_data['post_category'] = array_map('intval', $payload['category_ids']);
        }
        if (isset($payload['tag_ids']) && is_array($payload['tag_ids'])) {
            $update_data['tags_input'] = array_map('intval', $payload['tag_ids']);
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
            'status'    => get_post_status($post_id),
            'permalink' => get_permalink($post_id),
        );
    }

    private static function op_upload_media($payload) {
        $file_name = sanitize_file_name($payload['file_name'] ?? 'media.jpg');
        $base64    = $payload['file_data'] ?? '';

        if (empty($base64)) {
            throw new Exception('No file_data provided for upload.');
        }

        $decoded = base64_decode($base64);
        if ($decoded === false) {
            throw new Exception('Invalid base64 encoded file data.');
        }

        $upload = wp_upload_bits($file_name, null, $decoded);
        if (!empty($upload['error'])) {
            throw new Exception($upload['error']);
        }

        $file_path = $upload['file'];
        $wp_filetype = wp_check_filetype($file_name, null);

        $attachment = array(
            'post_mime_type' => $wp_filetype['type'],
            'post_title'     => preg_replace('/.[^.]+$/', '', $file_name),
            'post_content'   => '',
            'post_status'    => 'inherit'
        );

        $attach_id = wp_insert_attachment($attachment, $file_path);
        if (is_wp_error($attach_id)) {
            throw new Exception($attach_id->get_error_message());
        }

        require_once(ABSPATH . 'wp-admin/includes/image.php');
        $attach_data = wp_generate_attachment_metadata($attach_id, $file_path);
        wp_update_attachment_metadata($attach_id, $attach_data);

        if (!empty($payload['alt_text'])) {
            update_post_meta($attach_id, '_wp_attachment_image_alt', sanitize_text_field($payload['alt_text']));
        }

        return array(
            'media_id' => $attach_id,
            'url'      => wp_get_attachment_url($attach_id)
        );
    }

    private static function op_update_metadata($payload) {
        $post_id = (int)($payload['post_id'] ?? 0);
        if (!$post_id || !get_post($post_id)) {
            throw new Exception("Post #{$post_id} not found.");
        }

        $updated = array();
        foreach ($payload['meta'] as $key => $value) {
            $s_key = sanitize_key($key);
            $s_val = sanitize_text_field($value);
            update_post_meta($post_id, $s_key, $s_val);
            $updated[$s_key] = $s_val;
        }

        return array(
            'post_id' => $post_id,
            'updated' => $updated
        );
    }

    private static function op_add_internal_link($payload) {
        $source_post_id = (int)($payload['source_post_id'] ?? 0);
        $target_url     = esc_url_raw($payload['target_url'] ?? '');
        $anchor_text    = sanitize_text_field($payload['anchor_text'] ?? '');

        if (!$source_post_id || empty($target_url) || empty($anchor_text)) {
            throw new Exception('Missing required fields for internal linking.');
        }

        $post = get_post($source_post_id);
        if (!$post) {
            throw new Exception("Source post #{$source_post_id} not found.");
        }

        $content = $post->post_content;
        $pattern = '/' . preg_quote($anchor_text, '/') . '(?![^<]*>|[^<>]*</a>)/i';
        
        $link = sprintf('<a href="%s" title="%s">%s</a>', $target_url, esc_attr($anchor_text), $anchor_text);
        
        $new_content = preg_replace($pattern, $link, $content, 1, $count);

        if ($count === 0) {
            throw new Exception('Anchor text not found in source post content, or already linked.');
        }

        $result = wp_update_post(array(
            'ID' => $source_post_id,
            'post_content' => $new_content
        ), true);

        if (is_wp_error($result)) {
            throw new Exception($result->get_error_message());
        }

        return array(
            'post_id'     => $source_post_id,
            'linked_url'  => $target_url,
            'anchor_text' => $anchor_text
        );
    }
}
/* --- END class-seo-autopilot-worker.php --- */

/* --- BEGIN class-seo-autopilot-outbound.php --- */
/**
 * Outbound Reverse-Connection Subsystem
 *
 * Initiates outbound HTTPS requests to SaaS (WordPress Plugin -> SaaS)
 * eliminating any requirement for inbound HTTP requests.
 *
 * @package SEO_Autopilot_Connector
 */



class SEO_Autopilot_Outbound {

    private static $instance = null;

    const DEFAULT_SAAS_URL       = 'https://seo-hazel-eight.vercel.app';
    const OPTION_SAAS_URL         = 'seo_autopilot_saas_url';
    const OPTION_SITE_ID          = 'seo_autopilot_site_id';
    const OPTION_SECRET_KEY       = 'seo_autopilot_secret_key';
    const OPTION_LAST_SYNC        = 'seo_autopilot_last_sync_at';
    const OPTION_LAST_ERROR       = 'seo_autopilot_last_error';
    const OPTION_CONNECTION_MODE  = 'seo_autopilot_connection_mode';
    const CRON_HOOK               = 'seo_autopilot_cron_poll_jobs';

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_filter('cron_schedules', array($this, 'add_cron_intervals'));
        add_action(self::CRON_HOOK, array($this, 'handle_cron_poll'));
        add_action('init', array($this, 'ensure_cron_scheduled'));
    }

    public static function init_subsystem() {
        if (!get_option(self::OPTION_SAAS_URL)) {
            update_option(self::OPTION_SAAS_URL, self::DEFAULT_SAAS_URL);
        }
        if (!get_option(self::OPTION_CONNECTION_MODE)) {
            update_option(self::OPTION_CONNECTION_MODE, 'outbound');
        }
    }

    public function add_cron_intervals($schedules) {
        if (!isset($schedules['every_minute'])) {
            $schedules['every_minute'] = array(
                'interval' => 60,
                'display'  => __('Every Minute', 'seo-autopilot-connector'),
            );
        }
        return $schedules;
    }

    public function ensure_cron_scheduled() {
        if ((is_admin() || wp_doing_cron()) && !wp_next_scheduled(self::CRON_HOOK) && self::is_paired()) {
            wp_schedule_event(time(), 'every_minute', self::CRON_HOOK);
        }
    }

    public static function is_paired() {
        $site_id = get_option(self::OPTION_SITE_ID);
        $secret  = get_option(self::OPTION_SECRET_KEY);
        $status  = get_option(SEO_Autopilot_Auth::OPTION_STATUS);
        return !empty($site_id) && !empty($secret) && $status === 'active';
    }

    public static function get_saas_url() {
        $url = get_option(self::OPTION_SAAS_URL, self::DEFAULT_SAAS_URL);
        return untrailingslashit($url);
    }

    /**
     * Register / Pair this WordPress site with the SaaS
     */
    public static function pair_with_saas($saas_url = null, $user_id = 0) {
        if (empty($saas_url)) {
            $saas_url = self::get_saas_url();
        }
        $saas_url = untrailingslashit($saas_url);
        update_option(self::OPTION_SAAS_URL, $saas_url);

        // 1. Generate local cryptographically secure secret
        $creds = SEO_Autopilot_Auth::generate_api_key($user_id);
        $secret_key = $creds['raw_key'];
        update_option(self::OPTION_SECRET_KEY, $secret_key);

        // 2. Prepare telemetry payload
        $telemetry = self::get_telemetry_data();
        $payload = array(
            'site_url'       => get_site_url(),
            'site_name'      => get_bloginfo('name'),
            'secret_key'     => $secret_key,
            'wp_version'     => $telemetry['wp_version'],
            'php_version'    => $telemetry['php_version'],
            'plugin_version' => $telemetry['plugin_version'],
            'seo_plugins'    => $telemetry['seo_plugins'],
        );

        $endpoint = $saas_url . '/api/integrations/wordpress/outbound/register';

        $response = wp_remote_post($endpoint, array(
            'headers'     => array(
                'Content-Type' => 'application/json',
                'Accept'       => 'application/json',
            ),
            'body'        => wp_json_encode($payload),
            'timeout'     => 15,
            'sslverify'   => true,
            'data_format' => 'body',
        ));

        if (is_wp_error($response)) {
            $err_msg = $response->get_error_message();
            update_option(self::OPTION_LAST_ERROR, $err_msg);
            SEO_Autopilot_Activity::log('outbound.register_failed', 'saas', $user_id, 'Registration failed: ' . $err_msg, 500);
            return new WP_Error('outbound_register_failed', $err_msg);
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code >= 400 || empty($body['success'])) {
            $err_msg = !empty($body['error']) ? $body['error'] : 'Registration returned HTTP ' . $code;
            update_option(self::OPTION_LAST_ERROR, $err_msg);
            SEO_Autopilot_Activity::log('outbound.register_rejected', 'saas', $user_id, 'Registration rejected: ' . $err_msg, $code);
            return new WP_Error('outbound_register_rejected', $err_msg);
        }

        $site_id = $body['site_id'];
        update_option(self::OPTION_SITE_ID, $site_id);
        update_option(self::OPTION_LAST_SYNC, current_time('mysql', 1));
        delete_option(self::OPTION_LAST_ERROR);

        // Ensure background polling is scheduled
        if (!wp_next_scheduled(self::CRON_HOOK)) {
            wp_schedule_event(time(), 'every_minute', self::CRON_HOOK);
        }

        SEO_Autopilot_Activity::log('outbound.paired', 'saas', $user_id, 'Successfully paired site with SaaS (Site ID: ' . $site_id . ')');

        return array(
            'success' => true,
            'site_id' => $site_id,
            'message' => 'Successfully connected to SEO Autopilot SaaS.',
        );
    }

    /**
     * Poll SaaS for pending jobs and execute them locally
     */
    public static function notify_disconnect() {
        if (!self::is_paired()) return;

        $saas_url = self::get_saas_url();
        $site_id  = get_option(self::OPTION_SITE_ID);
        
        if (!$saas_url || !$site_id) return;

        $endpoint = $saas_url . '/api/integrations/wordpress/outbound/disconnect';
        
        wp_remote_post($endpoint, array(
            'blocking'    => false, // Don't block WP execution
            'headers'     => array(
                'Content-Type'            => 'application/json',
                'Accept'                  => 'application/json',
                'X-SEO-Autopilot-Site-ID' => $site_id,
            ),
        ));
    }

    public static function poll_and_execute_jobs() {
        if (!self::is_paired()) {
            return false;
        }

        // 1. Prevent concurrent polling runs (30-second lock)
        $lock = get_transient('seo_ap_poll_lock');
        if ($lock) {
            return false;
        }
        set_transient('seo_ap_poll_lock', 1, 30);

        // 2. Respect failure backoff (don't hammer server if unreachable)
        $backoff = get_transient('seo_ap_poll_backoff');
        if ($backoff) {
            delete_transient('seo_ap_poll_lock');
            return false;
        }

        try {
            $site_id  = get_option(self::OPTION_SITE_ID);
            $secret   = get_option(self::OPTION_SECRET_KEY);
            $saas_url = self::get_saas_url();

            $telemetry = self::get_telemetry_data();
            $payload_data = array(
                'telemetry' => $telemetry,
            );
            $body_json = wp_json_encode($payload_data);

            // Compute HMAC Signature with timestamp and nonce
            $timestamp = (string)time();
            $nonce     = wp_generate_password(16, false);
            $signature = hash_hmac('sha256', $timestamp . '.' . $nonce . '.' . $body_json, $secret);

            $endpoint = $saas_url . '/api/integrations/wordpress/outbound/poll';

            $response = wp_remote_post($endpoint, array(
                'headers'     => array(
                    'Content-Type'                 => 'application/json',
                    'Accept'                       => 'application/json',
                    'X-SEO-Autopilot-Site-ID'      => $site_id,
                    'X-SEO-Autopilot-Timestamp'    => $timestamp,
                    'X-SEO-Autopilot-Nonce'        => $nonce,
                    'X-SEO-Autopilot-Signature'    => $signature,
                ),
                'body'        => $body_json,
                'timeout'     => 8,
                'sslverify'   => true,
                'data_format' => 'body',
            ));

            if (is_wp_error($response)) {
                $err = $response->get_error_message();
                update_option(self::OPTION_LAST_ERROR, $err);
                // Backoff for 60 seconds on network failure
                set_transient('seo_ap_poll_backoff', 1, 60);
                delete_transient('seo_ap_poll_lock');
                return false;
            }

            $code = wp_remote_retrieve_response_code($response);
            $body = json_decode(wp_remote_retrieve_body($response), true);

            if ($code >= 400 || empty($body['success'])) {
                $err = $body['error'] ?? ('HTTP ' . $code);
                update_option(self::OPTION_LAST_ERROR, $err);
                set_transient('seo_ap_poll_backoff', 1, 60);
                delete_transient('seo_ap_poll_lock');
                return false;
            }

            update_option(self::OPTION_LAST_SYNC, current_time('mysql', 1));
            delete_option(self::OPTION_LAST_ERROR);
            delete_transient('seo_ap_poll_backoff');

            // If no pending job, return early
            if (empty($body['has_job']) || empty($body['job'])) {
                delete_transient('seo_ap_poll_lock');
                return true;
            }

            // Execute Job via Worker with safe error isolation
            $job = $body['job'];
            if (class_exists('SEO_Autopilot_Worker')) {
                $execution_result = SEO_Autopilot_Worker::execute_job($job);

                // Report result back to SaaS
                self::report_job_result(
                    $job['id'],
                    $execution_result['status'],
                    $execution_result['result'] ?? null,
                    $execution_result['error'] ?? null
                );
            }

            delete_transient('seo_ap_poll_lock');
            return true;
        } catch (\Throwable $e) {
            error_log('[SEO Autopilot Outbound] Poll exception: ' . $e->getMessage());
            update_option(self::OPTION_LAST_ERROR, $e->getMessage());
            set_transient('seo_ap_poll_backoff', 1, 60);
            delete_transient('seo_ap_poll_lock');
            return false;
        }
    }

    /**
     * Report execution result or failure back to SaaS
     */
    public static function report_job_result($job_id, $status, $result = null, $error = null) {
        try {
            $site_id  = get_option(self::OPTION_SITE_ID);
            $secret   = get_option(self::OPTION_SECRET_KEY);
            $saas_url = self::get_saas_url();

            $payload_data = array(
                'job_id' => $job_id,
                'status' => $status,
                'result' => $result,
                'error'  => $error,
            );
            $body_json = wp_json_encode($payload_data);

            $timestamp = (string)time();
            $nonce     = wp_generate_password(16, false);
            $signature = hash_hmac('sha256', $timestamp . '.' . $nonce . '.' . $body_json, $secret);

            $endpoint = $saas_url . '/api/integrations/wordpress/outbound/report';

            $response = wp_remote_post($endpoint, array(
                'headers'     => array(
                    'Content-Type'                 => 'application/json',
                    'Accept'                       => 'application/json',
                    'X-SEO-Autopilot-Site-ID'      => $site_id,
                    'X-SEO-Autopilot-Timestamp'    => $timestamp,
                    'X-SEO-Autopilot-Nonce'        => $nonce,
                    'X-SEO-Autopilot-Signature'    => $signature,
                ),
                'body'        => $body_json,
                'timeout'     => 10,
                'sslverify'   => true,
                'data_format' => 'body',
            ));

            if (is_wp_error($response)) {
                SEO_Autopilot_Activity::log('outbound.report_failed', 'job', 0, "Failed to report job #{$job_id}: " . $response->get_error_message(), 500);
                return false;
            }

            SEO_Autopilot_Activity::log('outbound.job_completed', 'job', 0, "Reported job #{$job_id} ({$status}) to SaaS");
            return true;
        } catch (\Throwable $e) {
            error_log('[SEO Autopilot Outbound] Report error: ' . $e->getMessage());
            return false;
        }
    }

    public function handle_cron_poll() {
        self::poll_and_execute_jobs();
    }

    public static function get_telemetry_data() {
        $has_rankmath = defined('RANK_MATH_VERSION') || class_exists('RankMath');
        $has_yoast    = defined('WPSEO_VERSION') || class_exists('WPSEO_Options');
        $has_aioseo   = defined('AIOSEO_VERSION');

        return array(
            'wp_version'     => get_bloginfo('version'),
            'php_version'    => phpversion(),
            'plugin_version' => SEO_AUTOPILOT_VERSION,
            'seo_plugins'    => array(
                'rank_math' => $has_rankmath,
                'yoast'     => $has_yoast,
                'aioseo'    => $has_aioseo,
            ),
        );
    }
}
/* --- END class-seo-autopilot-outbound.php --- */

/* --- BEGIN class-seo-autopilot-rest.php --- */
/**
 * REST API Subsystem
 *
 * Namespace: /wp-json/seo-autopilot/v1/
 *
 * @package SEO_Autopilot_Connector
 */



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

        // If the ping is from the cloud, immediately run the outbound worker
        // so the user doesn't have to wait for cron to trigger naturally.
        if ($is_connected && isset($_GET['wake'])) {
            // Ignore abort so PHP finishes the job even if the cloud drops the connection
            ignore_user_abort(true);
            if (class_exists('SEO_Autopilot_Outbound')) {
                SEO_Autopilot_Outbound::poll_and_execute_jobs();
            }
        }

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
/* --- END class-seo-autopilot-rest.php --- */

/* --- BEGIN class-seo-autopilot-updater.php --- */
class SEO_Autopilot_Updater {
    private $version_url;
    const TRANSIENT_KEY = 'seo_autopilot_update_info_v1';
    
    public function __construct() {
        $saas_url = get_option('seo_autopilot_saas_url', 'https://seo-hazel-eight.vercel.app');
        $this->version_url = rtrim($saas_url, '/') . '/api/integrations/wordpress/plugin/version';
        
        add_filter('pre_set_site_transient_update_plugins', array($this, 'check_for_updates'));
        add_filter('plugins_api', array($this, 'plugin_api_call'), 10, 3);
    }
    
    public function check_for_updates($transient) {
        if (empty($transient) || !is_object($transient)) {
            return $transient;
        }
        
        try {
            // Check transient cache, but bypass if force-checking updates
            $is_force = isset($_GET['force-check']) || (isset($_GET['action']) && $_GET['action'] === 'check-updates');
            $body = $is_force ? false : get_transient(self::TRANSIENT_KEY);

            if (false === $body) {
                $response = wp_remote_get($this->version_url, array(
                    'timeout'   => 4,
                    'sslverify' => true,
                ));

                if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
                    set_transient(self::TRANSIENT_KEY, array('version' => SEO_AUTOPILOT_VERSION), 300);
                    return $transient;
                }
                
                $body = json_decode(wp_remote_retrieve_body($response), true);
                if (empty($body) || !is_array($body)) {
                    return $transient;
                }

                // Cache valid response for 2 hours
                set_transient(self::TRANSIENT_KEY, $body, 2 * HOUR_IN_SECONDS);
            }
            
            if (empty($body['version'])) {
                return $transient;
            }
            
            $remote_version = $body['version'];
            if (version_compare(SEO_AUTOPILOT_VERSION, $remote_version, '<')) {
                $plugin_file = defined('SEO_AUTOPILOT_PLUGIN_BASENAME') ? SEO_AUTOPILOT_PLUGIN_BASENAME : 'seo-autopilot-connector/seo-autopilot-connector.php';
                
                $obj = new stdClass();
                $obj->slug = 'seo-autopilot-connector';
                $obj->plugin = $plugin_file;
                $obj->new_version = $remote_version;
                $obj->url = $body['author_profile'] ?? 'https://seautopilot.io';
                $obj->package = $body['download_url'] ?? '';
                $obj->icons = array(
                    '1x' => 'https://ps.w.org/seo-autopilot/assets/icon-128x128.png',
                );
                
                if (!isset($transient->response)) {
                    $transient->response = array();
                }
                $transient->response[$plugin_file] = $obj;
                $transient->response['seo-autopilot-connector/seo-autopilot-connector.php'] = $obj;
            }
        } catch (\Throwable $e) {
            error_log('[SEO Autopilot Updater] Update check error: ' . $e->getMessage());
        }
        
        return $transient;
    }
    
    public function plugin_api_call($res, $action, $args) {
        if ('plugin_information' !== $action || empty($args->slug) || 'seo-autopilot-connector' !== $args->slug) {
            return $res;
        }
        
        try {
            $body = get_transient(self::TRANSIENT_KEY);
            if (false === $body || empty($body['version'])) {
                $response = wp_remote_get($this->version_url, array('timeout' => 3));
                if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
                    return $res;
                }
                $body = json_decode(wp_remote_retrieve_body($response), true);
            }
            
            if (empty($body) || empty($body['version'])) {
                return $res;
            }
            
            $res = new stdClass();
            $res->name = $body['name'] ?? 'SEO Autopilot Agent Connector';
            $res->slug = $body['slug'] ?? 'seo-autopilot-connector';
            $res->version = $body['version'];
            $res->tested = $body['tested'] ?? '6.4';
            $res->requires = $body['requires'] ?? '5.8';
            $res->author = $body['author'] ?? 'SEO Autopilot Team';
            $res->author_profile = $body['author_profile'] ?? 'https://seautopilot.io';
            $res->download_link = $body['download_url'] ?? '';
            $res->trunk = $body['download_url'] ?? '';
            $res->requires_php = $body['requires_php'] ?? '7.4';
            $res->last_updated = $body['last_updated'] ?? '';
            $res->sections = array(
                'description' => $body['sections']['description'] ?? '',
                'changelog'   => $body['sections']['changelog'] ?? '',
            );
        } catch (\Throwable $e) {
            error_log('[SEO Autopilot Updater] Plugin info error: ' . $e->getMessage());
        }
        
        return $res;
    }
}
/* --- END class-seo-autopilot-updater.php --- */

/* --- BEGIN class-seo-autopilot-admin.php --- */
/**
 * WordPress Admin Settings Page Subsystem
 *
 * @package SEO_Autopilot_Connector
 */



class SEO_Autopilot_Admin {

    private static $instance = null;

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'), 9);
        add_action('admin_init', array($this, 'handle_admin_actions'));
        add_filter('plugin_action_links', array($this, 'filter_plugin_action_links'), 10, 2);
        add_action('admin_bar_menu', array($this, 'add_admin_bar_menu'), 100);
        add_action('admin_notices', array($this, 'render_setup_notice'));
    }

    public function add_admin_bar_menu($wp_admin_bar) {
        if (!current_user_can('manage_options')) return;
        $wp_admin_bar->add_node(array(
            'id'    => 'seo-autopilot-topbar',
            'title' => '⚡ SEO Autopilot',
            'href'  => admin_url('options-general.php?page=seo-autopilot-connector'),
            'meta'  => array('title' => 'SEO Autopilot Settings & Pairing'),
        ));
    }

    public function render_setup_notice() {
        $screen = get_current_screen();
        if (!$screen || !current_user_can('manage_options')) return;
        
        // Only show if not on our own settings page
        if ($screen->id === 'settings_page_seo-autopilot-connector') {
            return;
        }

        $is_paired = SEO_Autopilot_Outbound::is_paired();
        if (!$is_paired) {
            echo '<div class="notice notice-info is-dismissible" style="border-left-color: #4f46e5; padding: 12px 16px;">
                <p style="font-size: 14px; margin: 0 0 8px 0;"><strong>🚀 SEO Autopilot Agent Connector is active!</strong> Pair your site with the AI SaaS platform to start autonomous optimization.</p>
                <p style="margin: 0;"><a href="' . esc_url(admin_url('options-general.php?page=seo-autopilot-connector')) . '" class="button button-primary" style="background: #4f46e5; border-color: #4338ca;">Open SEO Autopilot Settings &rarr;</a></p>
            </div>';
        }
    }

    public function filter_plugin_action_links($links, $file) {
        if (strpos($file, 'seo-autopilot-connector') !== false) {
            $settings_link = '<a href="' . esc_url(admin_url('options-general.php?page=seo-autopilot-connector')) . '" style="font-weight: 700; color: #4f46e5;">' . __('Settings', 'seo-autopilot-connector') . '</a>';
            array_unshift($links, $settings_link);
        }
        return $links;
    }

    public function add_admin_menu() {
        // Register cleanly under Settings -> SEO Autopilot
        add_options_page(
            'SEO Autopilot Agent Connector',
            'SEO Autopilot',
            'manage_options',
            'seo-autopilot-connector',
            array($this, 'render_admin_page')
        );
    }

    public function handle_admin_actions() {
        if (!isset($_POST['seo_ap_action']) || !current_user_can('manage_options')) {
            return;
        }

        check_admin_referer('seo_ap_admin_nonce', 'seo_ap_nonce');

        try {
            $action = sanitize_key($_POST['seo_ap_action']);

            if ($action === 'pair_saas') {
                $saas_url = esc_url_raw($_POST['seo_ap_saas_url'] ?? SEO_Autopilot_Outbound::DEFAULT_SAAS_URL);
                $user_id  = (int)($_POST['seo_ap_user_id'] ?? get_current_user_id());

                $result = SEO_Autopilot_Outbound::pair_with_saas($saas_url, $user_id);
                if (is_wp_error($result)) {
                    wp_safe_redirect(add_query_arg(array('page' => 'seo-autopilot-connector', 'error' => urlencode($result->get_error_message())), admin_url('options-general.php')));
                    exit;
                }

                wp_safe_redirect(add_query_arg(array('page' => 'seo-autopilot-connector', 'msg' => 'paired'), admin_url('options-general.php')));
                exit;
            }

            if ($action === 'sync_jobs') {
                SEO_Autopilot_Outbound::poll_and_execute_jobs();
                wp_safe_redirect(add_query_arg(array('page' => 'seo-autopilot-connector', 'msg' => 'synced'), admin_url('options-general.php')));
                exit;
            }

            if ($action === 'generate' || $action === 'rotate') {
                $user_id  = (int)($_POST['seo_ap_user_id'] ?? get_current_user_id());
                $saas_url = esc_url_raw($_POST['seo_ap_saas_url'] ?? SEO_Autopilot_Outbound::get_saas_url());
                
                $creds = SEO_Autopilot_Auth::generate_api_key($user_id);
                update_option(SEO_Autopilot_Outbound::OPTION_SECRET_KEY, $creds['raw_key']);
                SEO_Autopilot_Outbound::pair_with_saas($saas_url, $user_id);

                set_transient('seo_ap_fresh_key_' . get_current_user_id(), $creds['raw_key'], 300);
                wp_safe_redirect(add_query_arg(array('page' => 'seo-autopilot-connector', 'msg' => 'rotated'), admin_url('options-general.php')));
                exit;
            }

            if ($action === 'revoke') {
                SEO_Autopilot_Outbound::notify_disconnect();
                SEO_Autopilot_Auth::revoke_api_key();
                delete_option(SEO_Autopilot_Outbound::OPTION_SITE_ID);
                delete_option(SEO_Autopilot_Outbound::OPTION_SECRET_KEY);
                delete_option(SEO_Autopilot_Outbound::OPTION_LAST_SYNC);
                wp_safe_redirect(add_query_arg(array('page' => 'seo-autopilot-connector', 'msg' => 'revoked'), admin_url('options-general.php')));
                exit;
            }
        } catch (\Throwable $e) {
            error_log('[SEO Autopilot Admin] Action error: ' . $e->getMessage());
            wp_safe_redirect(add_query_arg(array('page' => 'seo-autopilot-connector', 'error' => urlencode($e->getMessage())), admin_url('options-general.php')));
            exit;
        }
    }

    public function render_admin_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        try {
            $is_paired   = SEO_Autopilot_Outbound::is_paired();
            $site_id     = get_option(SEO_Autopilot_Outbound::OPTION_SITE_ID, '');
            $saas_url    = SEO_Autopilot_Outbound::get_saas_url();
            $last_sync   = get_option(SEO_Autopilot_Outbound::OPTION_LAST_SYNC, '');
            $last_error  = get_option(SEO_Autopilot_Outbound::OPTION_LAST_ERROR, '');
        $info        = SEO_Autopilot_Auth::get_connection_info();
        $fresh_key   = get_transient('seo_ap_fresh_key_' . get_current_user_id());
        if ($fresh_key) {
            delete_transient('seo_ap_fresh_key_' . get_current_user_id());
        }

        $logs  = SEO_Autopilot_Activity::get_recent_logs(25);
        $users = get_users(array('role__in' => array('administrator', 'editor', 'author'), 'number' => 50));
        ?>
        <div class="wrap" style="max-width: 960px; margin-top: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            
            <?php if (isset($_GET['msg']) && $_GET['msg'] === 'paired') : ?>
                <div class="notice notice-success is-dismissible"><p><strong>✓ Connected successfully!</strong> Outbound agent is now paired and ready.</p></div>
            <?php elseif (isset($_GET['msg']) && $_GET['msg'] === 'synced') : ?>
                <div class="notice notice-success is-dismissible"><p><strong>✓ Sync complete!</strong> Checked SaaS queue for pending SEO tasks.</p></div>
            <?php elseif (isset($_GET['msg']) && $_GET['msg'] === 'rotated') : ?>
                <div class="notice notice-success is-dismissible"><p><strong>✓ Credentials rotated!</strong> Shared key updated.</p></div>
            <?php elseif (isset($_GET['msg']) && $_GET['msg'] === 'revoked') : ?>
                <div class="notice notice-warning is-dismissible"><p>Connection revoked. Agent access has been disabled.</p></div>
            <?php elseif (isset($_GET['error'])) : ?>
                <div class="notice notice-error is-dismissible"><p><strong>Connection Error:</strong> <?php echo esc_html(urldecode($_GET['error'])); ?></p></div>
            <?php endif; ?>

            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 24px;">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="background: #4f46e5; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 22px;">⚡</div>
                        <div>
                            <h1 style="font-size: 20px; font-weight: 700; margin: 0; color: #0f172a;">SEO Autopilot Agent Connector</h1>
                            <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">Outbound Reverse-Connection Architecture &bull; Version <?php echo esc_html(SEO_AUTOPILOT_VERSION); ?></p>
                        </div>
                    </div>
                    <div>
                        <?php if ($is_paired) : ?>
                            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-weight: 600; font-size: 12px; border-radius: 9999px;">
                                <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span> Outbound Connected
                            </span>
                        <?php elseif (!empty($last_error)) : ?>
                            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-weight: 600; font-size: 12px; border-radius: 9999px;">
                                <span style="width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;"></span> Connection Warning
                            </span>
                        <?php else : ?>
                            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-weight: 600; font-size: 12px; border-radius: 9999px;">
                                <span style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%;"></span> Disconnected
                            </span>
                        <?php endif; ?>
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #1e293b;">🌐 How Outbound Connection Works</h3>
                    <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.6;">
                        This WordPress site makes secure, outbound HTTPS requests to your SaaS queue. 
                        <strong>No inbound requests are required</strong>, completely bypassing Cloudflare, WAFs, and hosting firewall blocks.
                    </p>
                </div>

                <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; margin-bottom: 24px;">
                    <!-- Connection Metadata -->
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                        <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #334155;">Connection Status</h4>
                        <table style="width: 100%; font-size: 12px; color: #475569; line-height: 2;">
                            <tr>
                                <td style="font-weight: 500; width: 130px;">Architecture:</td>
                                <td style="font-weight: 600; color: #059669;">Outbound HTTPS (Reverse)</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 500;">SaaS Endpoint:</td>
                                <td><code><?php echo esc_html($saas_url); ?></code></td>
                            </tr>
                            <tr>
                                <td style="font-weight: 500;">Paired Site ID:</td>
                                <td><code><?php echo esc_html($site_id ?: 'Not Paired'); ?></code></td>
                            </tr>
                            <tr>
                                <td style="font-weight: 500;">Last Sync:</td>
                                <td><?php echo esc_html($last_sync ?: 'Never'); ?></td>
                            </tr>
                            <tr>
                                <td style="font-weight: 500;">Cron Worker:</td>
                                <td><?php echo wp_next_scheduled(SEO_Autopilot_Outbound::CRON_HOOK) ? '<span style="color:#059669;">✓ Active (Every 1m)</span>' : '<span style="color:#dc2626;">Paused</span>'; ?></td>
                            </tr>
                        </table>

                        <?php if (!empty($last_error)) : ?>
                            <div style="margin-top: 10px; padding: 8px 12px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; font-size: 11px; color: #be123c;">
                                <strong>Last Error:</strong> <?php echo esc_html($last_error); ?>
                            </div>
                        <?php endif; ?>
                    </div>

                    <!-- Allowed Safe Operations -->
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                        <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #334155;">Allowed SEO Operations</h4>
                        <ul style="margin: 0; padding: 0; list-style: none; font-size: 12px; color: #475569; line-height: 1.8;">
                            <li><span style="color: #10b981;">✓</span> <strong>create_post / update_post</strong> (Drafts & approved publishing)</li>
                            <li><span style="color: #10b981;">✓</span> <strong>update_seo_meta</strong> (Rank Math, Yoast, AIOSEO)</li>
                            <li><span style="color: #10b981;">✓</span> <strong>upload_media</strong> (Safe image sideloading)</li>
                            <li><span style="color: #10b981;">✓</span> <strong>add_internal_links</strong> (Internal anchor link injection)</li>
                            <li><span style="color: #10b981;">✓</span> <strong>sync_site_info</strong> (Metadata & health telemetry)</li>
                            <li style="color: #94a3b8; font-size: 11px; margin-top: 4px;">🛡️ <em>Arbitrary PHP / SQL execution strictly disallowed.</em></li>
                        </ul>
                    </div>
                </div>

                <!-- Actions Bar -->
                <div style="display: flex; gap: 12px; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 1px solid #f1f5f9; flex-wrap: wrap;">
                    <form method="post" style="display: inline-flex; align-items: center; gap: 8px; flex: 1;">
                        <?php wp_nonce_field('seo_ap_admin_nonce', 'seo_ap_nonce'); ?>
                        <input type="hidden" name="seo_ap_action" value="pair_saas">
                        <input type="url" name="seo_ap_saas_url" value="<?php echo esc_attr($saas_url); ?>" placeholder="https://seo-hazel-eight.vercel.app" style="font-size: 12px; height: 34px; border-radius: 6px; width: 280px;">
                        <select name="seo_ap_user_id" style="font-size: 12px; height: 34px; border-radius: 6px;">
                            <?php foreach ($users as $u) : ?>
                                <option value="<?php echo esc_attr($u->ID); ?>" <?php selected($info['user_id'], $u->ID); ?>>
                                    Author: <?php echo esc_html($u->user_login); ?> (<?php echo esc_html(implode(', ', $u->roles)); ?>)
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <button type="submit" class="button button-primary" style="background: #4f46e5; border-color: #4f46e5; height: 34px;">
                            <?php echo $is_paired ? 'Re-Connect with SaaS' : 'Connect Outbound to SaaS'; ?>
                        </button>
                    </form>

                    <div style="display: inline-flex; gap: 8px; align-items: center;">
                        <?php if ($is_paired) : ?>
                            <form method="post" style="display: inline;">
                                <?php wp_nonce_field('seo_ap_admin_nonce', 'seo_ap_nonce'); ?>
                                <input type="hidden" name="seo_ap_action" value="sync_jobs">
                                <button type="submit" class="button" style="height: 34px;">
                                    ⚡ Sync & Run Jobs Now
                                </button>
                            </form>

                            <form method="post" onsubmit="return confirm('Are you sure you want to disconnect? Agent jobs will halt.');" style="display: inline;">
                                <?php wp_nonce_field('seo_ap_admin_nonce', 'seo_ap_nonce'); ?>
                                <input type="hidden" name="seo_ap_action" value="revoke">
                                <button type="submit" class="button" style="color: #dc2626; border-color: #fca5a5; height: 34px;">
                                    Disconnect
                                </button>
                            </form>
                        <?php endif; ?>
                    </div>
                </div>
            </div>

            <!-- Activity Logs Section -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <h3 style="font-size: 15px; font-weight: 700; margin: 0 0 16px 0; color: #0f172a;">Recent Agent Activity & Executions</h3>
                <?php if (empty($logs)) : ?>
                    <p style="font-size: 12px; color: #64748b; margin: 0;">No outbound agent activity recorded yet.</p>
                <?php else : ?>
                    <table class="wp-list-table widefat fixed striped" style="font-size: 12px; border: 1px solid #f1f5f9; border-radius: 6px;">
                        <thead>
                            <tr>
                                <th style="width: 150px;">Time (UTC)</th>
                                <th style="width: 140px;">Operation</th>
                                <th style="width: 90px;">Status</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($logs as $log) : ?>
                                <tr>
                                    <td><?php echo esc_html($log['created_at']); ?></td>
                                    <td><code><?php echo esc_html($log['event_type']); ?></code></td>
                                    <td>
                                        <?php if ((int)$log['http_status'] < 400) : ?>
                                            <span style="color: #059669; font-weight: 600;">✓ OK</span>
                                        <?php else : ?>
                                            <span style="color: #dc2626; font-weight: 600;">ERR (<?php echo esc_html($log['http_status']); ?>)</span>
                                        <?php endif; ?>
                                    </td>
                                    <td><?php echo esc_html($log['message']); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
            </div>
        </div>
        <?php
        } catch (\Throwable $e) {
            echo '<div class="notice notice-error"><p><strong>SEO Autopilot Connector:</strong> An error occurred while rendering the settings page: ' . esc_html($e->getMessage()) . '</p></div>';
        }
    }
}
/* --- END class-seo-autopilot-admin.php --- */

// ==========================================
// MAIN PLUGIN CONTROLLER & INITIALIZER
// ==========================================

final class SEO_Autopilot_Connector {

    private static $instance = null;

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->init_hooks();
    }

    private function init_hooks() {
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));

        add_action('plugins_loaded', array($this, 'init_subsystems'));
    }

    public function init_subsystems() {
        try {
            if (class_exists('SEO_Autopilot_Auth')) {
                SEO_Autopilot_Auth::instance();
            }
            if (class_exists('SEO_Autopilot_Activity')) {
                SEO_Autopilot_Activity::instance();
            }
            if (class_exists('SEO_Autopilot_Outbound')) {
                SEO_Autopilot_Outbound::instance();
                SEO_Autopilot_Outbound::init_subsystem();
            }
            if (class_exists('SEO_Autopilot_REST')) {
                SEO_Autopilot_REST::instance();
            }
            if (class_exists('SEO_Autopilot_Admin')) {
                SEO_Autopilot_Admin::instance();
            }
            if (class_exists('SEO_Autopilot_Updater')) {
                new SEO_Autopilot_Updater();
            }
        } catch (\Throwable $e) {
            error_log('[SEO Autopilot Connector] Subsystem initialization exception: ' . $e->getMessage());
        }
    }

    public function activate() {
        try {
            if (class_exists('SEO_Autopilot_Auth')) {
                SEO_Autopilot_Auth::init_db();
            }
            if (class_exists('SEO_Autopilot_Activity')) {
                SEO_Autopilot_Activity::init_db();
            }
            if (class_exists('SEO_Autopilot_Outbound')) {
                SEO_Autopilot_Outbound::init_subsystem();
                if (SEO_Autopilot_Outbound::is_paired() && !wp_next_scheduled(SEO_Autopilot_Outbound::CRON_HOOK)) {
                    wp_schedule_event(time(), 'every_minute', SEO_Autopilot_Outbound::CRON_HOOK);
                }
            }
            flush_rewrite_rules();
        } catch (\Throwable $e) {
            error_log('[SEO Autopilot Connector] Activation error: ' . $e->getMessage());
        }
    }

    public function deactivate() {
        try {
            if (class_exists('SEO_Autopilot_Outbound')) {
                SEO_Autopilot_Outbound::notify_disconnect();
                wp_clear_scheduled_hook(SEO_Autopilot_Outbound::CRON_HOOK);
            }
            flush_rewrite_rules();
        } catch (\Throwable $e) {
            error_log('[SEO Autopilot Connector] Deactivation error: ' . $e->getMessage());
        }
    }
}

// Global initialization
function seo_autopilot_connector() {
    try {
        return SEO_Autopilot_Connector::instance();
    } catch (\Throwable $e) {
        error_log('[SEO Autopilot Connector] Init error: ' . $e->getMessage());
        return null;
    }
}
seo_autopilot_connector();

// Direct Global Admin Hooks for guaranteed registration
if (is_admin()) {
    add_action('admin_menu', function() {
        add_options_page(
            'SEO Autopilot Agent Connector',
            'SEO Autopilot',
            'manage_options',
            'seo-autopilot-connector',
            function() {
                if (class_exists('SEO_Autopilot_Admin')) {
                    SEO_Autopilot_Admin::instance()->render_admin_page();
                }
            }
        );
    }, 5);

    add_filter('plugin_action_links_' . plugin_basename(__FILE__), function($links) {
        $settings_link = '<a href="' . esc_url(admin_url('options-general.php?page=seo-autopilot-connector')) . '" style="font-weight: 700; color: #4f46e5;">' . __('Settings', 'seo-autopilot-connector') . '</a>';
        array_unshift($links, $settings_link);
        return $links;
    });

    add_action('admin_bar_menu', function($wp_admin_bar) {
        if (!current_user_can('manage_options')) return;
        $wp_admin_bar->add_node(array(
            'id'    => 'seo-autopilot-topbar',
            'title' => '⚡ SEO Autopilot',
            'href'  => admin_url('options-general.php?page=seo-autopilot-connector'),
            'meta'  => array('title' => 'SEO Autopilot Settings & Pairing'),
        ));
    }, 100);
}
