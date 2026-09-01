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

/**
 * Fail-safe, multi-platform include resolver (Self-Healing)
 */
function seo_autopilot_safe_require($relative_file) {
    $candidates = array(
        __DIR__ . '/includes/' . $relative_file,
        __DIR__ . '/' . $relative_file,
        dirname(__FILE__) . '/includes/' . $relative_file,
        dirname(__FILE__) . '/' . $relative_file,
    );

    foreach ($candidates as $candidate) {
        if (@file_exists($candidate)) {
            try {
                require_once $candidate;
                return true;
            } catch (\Throwable $e) {
                error_log('[SEO Autopilot Connector] Exception loading ' . $relative_file . ': ' . $e->getMessage());
            }
        }
    }

    // Direct fallback attempt
    try {
        @include_once __DIR__ . '/includes/' . $relative_file;
        return true;
    } catch (\Throwable $e) {
        return false;
    }
}

// Load Core Subsystems Safely
seo_autopilot_safe_require('class-seo-autopilot-auth.php');
seo_autopilot_safe_require('class-seo-autopilot-activity.php');
seo_autopilot_safe_require('class-seo-autopilot-worker.php');
seo_autopilot_safe_require('class-seo-autopilot-outbound.php');
seo_autopilot_safe_require('class-seo-autopilot-rest.php');
seo_autopilot_safe_require('class-seo-autopilot-admin.php');
seo_autopilot_safe_require('class-seo-autopilot-updater.php');

if (class_exists('SEO_Autopilot_Updater')) {
    try {
        new SEO_Autopilot_Updater();
    } catch (\Throwable $e) {
        error_log('[SEO Autopilot Connector] Updater init error: ' . $e->getMessage());
    }
}

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
        // Initialize Admin UI immediately if class exists
        if (class_exists('SEO_Autopilot_Admin')) {
            SEO_Autopilot_Admin::instance();
        }
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

/**
 * Direct Global Admin Hooks (Guaranteed to fire on any WordPress installation)
 */
if (is_admin()) {
    // 1. Direct Admin Menu Registration
    add_action('admin_menu', function() {
        // Top Level Sidebar Menu
        add_menu_page(
            'SEO Autopilot Agent Connector',
            'SEO Autopilot',
            'manage_options',
            'seo-autopilot-connector',
            'seo_autopilot_direct_render_page',
            'dashicons-chart-line',
            30
        );

        // Submenu under SEO Autopilot
        add_submenu_page(
            'seo-autopilot-connector',
            'SEO Autopilot Settings',
            'Settings & Pairing',
            'manage_options',
            'seo-autopilot-connector',
            'seo_autopilot_direct_render_page'
        );

        // Submenu under Settings (options-general.php)
        add_options_page(
            'SEO Autopilot Agent Connector',
            'SEO Autopilot',
            'manage_options',
            'seo-autopilot-connector',
            'seo_autopilot_direct_render_page'
        );
    }, 5);

    // 2. Direct Plugin Action Links on Plugins Page
    add_filter('plugin_action_links_' . plugin_basename(__FILE__), function($links) {
        $settings_link = '<a href="' . esc_url(admin_url('admin.php?page=seo-autopilot-connector')) . '" style="font-weight: 700; color: #4f46e5;">' . __('Settings & Pairing', 'seo-autopilot-connector') . '</a>';
        array_unshift($links, $settings_link);
        return $links;
    });
    add_filter('plugin_action_links', function($links, $file) {
        if (strpos($file, 'seo-autopilot-connector') !== false) {
            $settings_link = '<a href="' . esc_url(admin_url('admin.php?page=seo-autopilot-connector')) . '" style="font-weight: 700; color: #4f46e5;">' . __('Settings & Pairing', 'seo-autopilot-connector') . '</a>';
            array_unshift($links, $settings_link);
        }
        return $links;
    }, 10, 2);

    // 3. Top Admin Bar Link
    add_action('admin_bar_menu', function($wp_admin_bar) {
        if (!current_user_can('manage_options')) return;
        $wp_admin_bar->add_node(array(
            'id'    => 'seo-autopilot-topbar',
            'title' => '⚡ SEO Autopilot',
            'href'  => admin_url('admin.php?page=seo-autopilot-connector'),
            'meta'  => array('title' => 'SEO Autopilot Settings & Pairing'),
        ));
    }, 100);

    // 4. Admin Notice Banner
    add_action('admin_notices', function() {
        if (!current_user_can('manage_options')) return;
        $screen = get_current_screen();
        if ($screen && (strpos($screen->id, 'seo-autopilot') !== false)) return;
        
        $is_paired = class_exists('SEO_Autopilot_Outbound') && SEO_Autopilot_Outbound::is_paired();
        if (!$is_paired) {
            echo '<div class="notice notice-info is-dismissible" style="border-left: 4px solid #4f46e5; padding: 12px 16px; margin: 15px 0;">
                <p style="font-size: 14px; margin: 0 0 8px 0;"><strong>🚀 SEO Autopilot Connector is active!</strong> Pair your site to start autonomous optimization.</p>
                <p style="margin: 0;"><a href="' . esc_url(admin_url('admin.php?page=seo-autopilot-connector')) . '" class="button button-primary" style="background: #4f46e5; border-color: #4338ca; font-weight: 600;">Open SEO Autopilot Settings &rarr;</a></p>
            </div>';
        }
    });
}

function seo_autopilot_direct_render_page() {
    if (!class_exists('SEO_Autopilot_Admin')) {
        seo_autopilot_safe_require('class-seo-autopilot-admin.php');
    }
    if (class_exists('SEO_Autopilot_Admin')) {
        SEO_Autopilot_Admin::instance()->render_admin_page();
    } else {
        echo '<div class="wrap"><h1>SEO Autopilot Agent Connector</h1><p>Unable to load admin template. Please check file permissions.</p></div>';
    }
}
