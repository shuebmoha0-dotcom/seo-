<?php
if (!defined('ABSPATH')) { exit; }

class SEO_Autopilot_Updater {
    private \;
    
    public function __construct() {
        // We fetch the update check URL from the paired SaaS, fallback to default Vercel deployment
        \ = get_option('seo_autopilot_saas_url', 'https://seo-hazel-eight.vercel.app');
        \->version_url = rtrim(\, '/') . '/api/integrations/wordpress/plugin/version';
        
        add_filter('pre_set_site_transient_update_plugins', array(\, 'check_for_updates'));
        add_filter('plugins_api', array(\, 'plugin_api_call'), 10, 3);
    }
    
    public function check_for_updates(\) {
        if (empty(\->checked)) {
            return \;
        }
        
        \ = wp_remote_get(\->version_url, array('timeout' => 5));
        if (is_wp_error(\)) {
            return \;
        }
        
        \ = json_decode(wp_remote_retrieve_body(\), true);
        if (empty(\) || empty(\['version'])) {
            return \;
        }
        
        \ = \['version'];
        if (version_compare(SEO_AUTOPILOT_VERSION, \, '<')) {
            \ = new stdClass();
            \->slug = 'seo-autopilot-connector';
            \->plugin = 'seo-autopilot-connector/seo-autopilot-connector.php';
            \->new_version = \;
            \->url = \['author_profile'];
            \->package = \['download_url'];
            \->icons = array(
                '1x' => 'https://ps.w.org/seo-autopilot/assets/icon-128x128.png', // Fallback or blank
            );
            
            \->response['seo-autopilot-connector/seo-autopilot-connector.php'] = \;
        }
        
        return \;
    }
    
    public function plugin_api_call(\, \, \) {
        if ('plugin_information' !== \ || 'seo-autopilot-connector' !== \->slug) {
            return \;
        }
        
        \ = wp_remote_get(\->version_url, array('timeout' => 5));
        if (is_wp_error(\)) {
            return \;
        }
        
        \ = json_decode(wp_remote_retrieve_body(\), true);
        if (empty(\)) {
            return \;
        }
        
        \ = new stdClass();
        \->name = \['name'];
        \->slug = \['slug'];
        \->version = \['version'];
        \->tested = \['tested'];
        \->requires = \['requires'];
        \->author = \['author'];
        \->author_profile = \['author_profile'];
        \->download_link = \['download_url'];
        \->trunk = \['download_url'];
        \->requires_php = \['requires_php'];
        \->last_updated = \['last_updated'];
        \->sections = array(
            'description' => \['sections']['description'],
            'changelog' => \['sections']['changelog']
        );
        
        return \;
    }
}
