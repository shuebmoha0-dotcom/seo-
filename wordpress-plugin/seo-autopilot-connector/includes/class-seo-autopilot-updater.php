<?php
if (!defined('ABSPATH')) { exit; }

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
        if (empty($transient) || !is_object($transient) || empty($transient->checked)) {
            return $transient;
        }
        
        try {
            // Check transient cache first to avoid slow HTTP calls
            $body = get_transient(self::TRANSIENT_KEY);
            if (false === $body) {
                $response = wp_remote_get($this->version_url, array(
                    'timeout'   => 3,
                    'sslverify' => true,
                ));

                if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
                    // Cache failure for 1 hour to prevent hammering
                    set_transient(self::TRANSIENT_KEY, array('version' => SEO_AUTOPILOT_VERSION), 3600);
                    return $transient;
                }
                
                $body = json_decode(wp_remote_retrieve_body($response), true);
                if (empty($body) || !is_array($body)) {
                    return $transient;
                }

                // Cache valid response for 12 hours
                set_transient(self::TRANSIENT_KEY, $body, 12 * HOUR_IN_SECONDS);
            }
            
            if (empty($body['version'])) {
                return $transient;
            }
            
            $remote_version = $body['version'];
            if (version_compare(SEO_AUTOPILOT_VERSION, $remote_version, '<')) {
                $obj = new stdClass();
                $obj->slug = 'seo-autopilot-connector';
                $obj->plugin = 'seo-autopilot-connector/seo-autopilot-connector.php';
                $obj->new_version = $remote_version;
                $obj->url = $body['author_profile'] ?? 'https://seautopilot.io';
                $obj->package = $body['download_url'] ?? '';
                $obj->icons = array(
                    '1x' => 'https://ps.w.org/seo-autopilot/assets/icon-128x128.png',
                );
                
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
