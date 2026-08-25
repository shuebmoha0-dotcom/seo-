<?php
if (!defined('ABSPATH')) { exit; }

class SEO_Autopilot_Updater {
    private $version_url;
    
    public function __construct() {
        // We fetch the update check URL from the paired SaaS, fallback to default Vercel deployment
        $saas_url = get_option('seo_autopilot_saas_url', 'https://seo-hazel-eight.vercel.app');
        $this->version_url = rtrim($saas_url, '/') . '/api/integrations/wordpress/plugin/version';
        
        add_filter('pre_set_site_transient_update_plugins', array($this, 'check_for_updates'));
        add_filter('plugins_api', array($this, 'plugin_api_call'), 10, 3);
    }
    
    public function check_for_updates($transient) {
        if (empty($transient->checked)) {
            return $transient;
        }
        
        $response = wp_remote_get($this->version_url, array('timeout' => 5));
        if (is_wp_error($response)) {
            return $transient;
        }
        
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (empty($body) || empty($body['version'])) {
            return $transient;
        }
        
        $remote_version = $body['version'];
        if (version_compare(SEO_AUTOPILOT_VERSION, $remote_version, '<')) {
            $obj = new stdClass();
            $obj->slug = 'seo-autopilot-connector';
            $obj->plugin = 'seo-autopilot-connector/seo-autopilot-connector.php';
            $obj->new_version = $remote_version;
            $obj->url = $body['author_profile'];
            $obj->package = $body['download_url'];
            $obj->icons = array(
                '1x' => 'https://ps.w.org/seo-autopilot/assets/icon-128x128.png', // Fallback or blank
            );
            
            $transient->response['seo-autopilot-connector/seo-autopilot-connector.php'] = $obj;
        }
        
        return $transient;
    }
    
    public function plugin_api_call($res, $action, $args) {
        if ('plugin_information' !== $action || 'seo-autopilot-connector' !== $args->slug) {
            return $res;
        }
        
        $response = wp_remote_get($this->version_url, array('timeout' => 5));
        if (is_wp_error($response)) {
            return $res;
        }
        
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (empty($body)) {
            return $res;
        }
        
        $res = new stdClass();
        $res->name = $body['name'];
        $res->slug = $body['slug'];
        $res->version = $body['version'];
        $res->tested = $body['tested'];
        $res->requires = $body['requires'];
        $res->author = $body['author'];
        $res->author_profile = $body['author_profile'];
        $res->download_link = $body['download_url'];
        $res->trunk = $body['download_url'];
        $res->requires_php = $body['requires_php'];
        $res->last_updated = $body['last_updated'];
        $res->sections = array(
            'description' => $body['sections']['description'],
            'changelog' => $body['sections']['changelog']
        );
        
        return $res;
    }
}
