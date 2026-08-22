<?php
/**
 * Outbound Reverse-Connection Subsystem
 *
 * Initiates outbound HTTPS requests to SaaS (WordPress Plugin -> SaaS)
 * eliminating any requirement for inbound HTTP requests.
 *
 * @package SEO_Autopilot_Connector
 */

if (!defined('ABSPATH')) {
    exit;
}

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
        if (!wp_next_scheduled(self::CRON_HOOK) && self::is_paired()) {
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
    public static function poll_and_execute_jobs() {
        if (!self::is_paired()) {
            return false;
        }

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
            'timeout'     => 12,
            'sslverify'   => true,
            'data_format' => 'body',
        ));

        if (is_wp_error($response)) {
            update_option(self::OPTION_LAST_ERROR, $response->get_error_message());
            return false;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code >= 400 || empty($body['success'])) {
            update_option(self::OPTION_LAST_ERROR, $body['error'] ?? ('HTTP ' . $code));
            return false;
        }

        update_option(self::OPTION_LAST_SYNC, current_time('mysql', 1));
        delete_option(self::OPTION_LAST_ERROR);

        // If no pending job, return early
        if (empty($body['has_job']) || empty($body['job'])) {
            return true;
        }

        // Execute Job via Worker
        $job = $body['job'];
        require_once SEO_AUTOPILOT_PLUGIN_DIR . 'includes/class-seo-autopilot-worker.php';
        $execution_result = SEO_Autopilot_Worker::execute_job($job);

        // Report result back to SaaS
        self::report_job_result(
            $job['id'],
            $execution_result['status'],
            $execution_result['result'] ?? null,
            $execution_result['error'] ?? null
        );

        return true;
    }

    /**
     * Report execution result or failure back to SaaS
     */
    public static function report_job_result($job_id, $status, $result = null, $error = null) {
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
            'timeout'     => 15,
            'sslverify'   => true,
            'data_format' => 'body',
        ));

        if (is_wp_error($response)) {
            SEO_Autopilot_Activity::log('outbound.report_failed', 'job', 0, "Failed to report job #{$job_id}: " . $response->get_error_message(), 500);
            return false;
        }

        SEO_Autopilot_Activity::log('outbound.job_completed', 'job', 0, "Reported job #{$job_id} ({$status}) to SaaS");
        return true;
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
