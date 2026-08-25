const fs = require('fs');
let content = fs.readFileSync('wordpress-plugin/seo-autopilot-connector/includes/class-seo-autopilot-outbound.php', 'utf8');

const disconnectFunc = `    public static function notify_disconnect() {
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

    public static function poll_and_execute_jobs() {`;

content = content.replace("    public static function poll_and_execute_jobs() {", disconnectFunc);
fs.writeFileSync('wordpress-plugin/seo-autopilot-connector/includes/class-seo-autopilot-outbound.php', content);
