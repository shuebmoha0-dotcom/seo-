<?php
/**
 * Authentication and Key Management Subsystem
 *
 * @package SEO_Autopilot_Connector
 */

if (!defined('ABSPATH')) {
    exit;
}

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
     * Extract key from Request Headers
     */
    private static function extract_key_from_request(WP_REST_Request $request) {
        $custom_header = $request->get_header('x-seo-autopilot-key');
        if (!empty($custom_header)) {
            return trim($custom_header);
        }

        $auth_header = $request->get_header('authorization');
        if (!empty($auth_header) && preg_match('/Bearer\s+(\S+)/i', $auth_header, $matches)) {
            return trim($matches[1]);
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
