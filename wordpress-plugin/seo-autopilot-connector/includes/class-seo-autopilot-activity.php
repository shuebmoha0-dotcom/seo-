<?php
/**
 * Activity Log and Rate Limiting Subsystem
 *
 * @package SEO_Autopilot_Connector
 */

if (!defined('ABSPATH')) {
    exit;
}

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

        // Keep table size under 1,000 rows
        if ($inserted && mt_rand(1, 50) === 1) {
            $wpdb->query("DELETE FROM {$table_name} WHERE id NOT IN (SELECT id FROM (SELECT id FROM {$table_name} ORDER BY id DESC LIMIT 1000) foo)");
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
