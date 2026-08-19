<?php
/**
 * Plugin Name:       SEO Autopilot Agent Connector
 * Plugin URI:        https://seautopilot.io
 * Description:       Official secure agent connector for SEO Autopilot SaaS. Enables autonomous SEO optimization, draft publishing, media uploads, and audit telemetry via scoped, revocable API credentials without sharing user passwords.
 * Version:           1.0.1
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

define('SEO_AUTOPILOT_VERSION', '1.0.1');
define('SEO_AUTOPILOT_API_VERSION', 'v1');
define('SEO_AUTOPILOT_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SEO_AUTOPILOT_PLUGIN_URL', plugin_dir_url(__FILE__));
define('SEO_AUTOPILOT_PLUGIN_BASENAME', plugin_basename(__FILE__));

// Require Core Subsystems
require_once SEO_AUTOPILOT_PLUGIN_DIR . 'includes/class-seo-autopilot-auth.php';
require_once SEO_AUTOPILOT_PLUGIN_DIR . 'includes/class-seo-autopilot-activity.php';
require_once SEO_AUTOPILOT_PLUGIN_DIR . 'includes/class-seo-autopilot-rest.php';
require_once SEO_AUTOPILOT_PLUGIN_DIR . 'includes/class-seo-autopilot-admin.php';

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
        SEO_Autopilot_Auth::instance();
        SEO_Autopilot_Activity::instance();
        SEO_Autopilot_REST::instance();

        if (is_admin()) {
            SEO_Autopilot_Admin::instance();
        }
    }

    public function activate() {
        SEO_Autopilot_Auth::init_db();
        SEO_Autopilot_Activity::init_db();
        flush_rewrite_rules();
    }

    public function deactivate() {
        flush_rewrite_rules();
    }
}

// Initialize Plugin
function seo_autopilot_connector() {
    return SEO_Autopilot_Connector::instance();
}
seo_autopilot_connector();
