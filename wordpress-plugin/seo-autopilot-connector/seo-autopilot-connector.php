<?php
/**
 * Plugin Name:       SEO Autopilot Agent Connector
 * Plugin URI:        https://seautopilot.io
 * Description:       Official secure agent connector for SEO Autopilot SaaS. Enables autonomous SEO optimization, draft publishing, media uploads, and audit telemetry via outbound reverse-connection architecture without sharing passwords or requiring inbound access.
 * Version:           1.1.8
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

define('SEO_AUTOPILOT_VERSION', '1.1.8');
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

/**
 * Fail-safe, multi-platform include resolver (Self-Healing)
 */
function seo_autopilot_safe_require($relative_file) {
    $dir = rtrim(SEO_AUTOPILOT_PLUGIN_DIR, '/\\') . '/';
    $candidates = array(
        $dir . 'includes/' . $relative_file,
        $dir . 'includes\\' . $relative_file,
        $dir . $relative_file,
        dirname(__FILE__) . '/includes/' . $relative_file,
        dirname(__FILE__) . '/' . $relative_file,
    );

    foreach ($candidates as $candidate) {
        if (file_exists($candidate) && is_readable($candidate)) {
            try {
                require_once $candidate;
                return true;
            } catch (\Throwable $e) {
                error_log('[SEO Autopilot Connector] Exception loading ' . $relative_file . ': ' . $e->getMessage());
                return false;
            }
        }
    }

    error_log('[SEO Autopilot Connector] Error: Unable to locate include file ' . $relative_file);
    if (is_admin()) {
        add_action('admin_notices', function() use ($relative_file) {
            echo '<div class="notice notice-error"><p><strong>SEO Autopilot Connector:</strong> Missing component file <code>' . esc_html($relative_file) . '</code>. Please reinstall the plugin.</p></div>';
        });
    }
    return false;
}

// Load Subsystems Safely
if (is_admin() || wp_doing_cron()) {
    if (seo_autopilot_safe_require('class-seo-autopilot-updater.php') && class_exists('SEO_Autopilot_Updater')) {
        try {
            new SEO_Autopilot_Updater();
        } catch (\Throwable $e) {
            error_log('[SEO Autopilot Connector] Updater init error: ' . $e->getMessage());
        }
    }
}

// Require Core Subsystems
seo_autopilot_safe_require('class-seo-autopilot-auth.php');
seo_autopilot_safe_require('class-seo-autopilot-activity.php');
seo_autopilot_safe_require('class-seo-autopilot-worker.php');
seo_autopilot_safe_require('class-seo-autopilot-outbound.php');
seo_autopilot_safe_require('class-seo-autopilot-rest.php');
seo_autopilot_safe_require('class-seo-autopilot-admin.php');

/**
 * Main Plugin Class
 */
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

// Initialize Plugin Safely
function seo_autopilot_connector() {
    try {
        return SEO_Autopilot_Connector::instance();
    } catch (\Throwable $e) {
        error_log('[SEO Autopilot Connector] Init error: ' . $e->getMessage());
        return null;
    }
}
seo_autopilot_connector();
