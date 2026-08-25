const fs = require('fs');
let mainFile = fs.readFileSync('wordpress-plugin/seo-autopilot-connector/seo-autopilot-connector.php', 'utf8');

mainFile = mainFile.replace(
    'public function deactivate() {\n        wp_clear_scheduled_hook(SEO_Autopilot_Outbound::CRON_HOOK);',
    'public function deactivate() {\n        SEO_Autopilot_Outbound::notify_disconnect();\n        wp_clear_scheduled_hook(SEO_Autopilot_Outbound::CRON_HOOK);'
);
fs.writeFileSync('wordpress-plugin/seo-autopilot-connector/seo-autopilot-connector.php', mainFile);

let adminFile = fs.readFileSync('wordpress-plugin/seo-autopilot-connector/includes/class-seo-autopilot-admin.php', 'utf8');
adminFile = adminFile.replace(
    "if ($action === 'revoke') {\n            SEO_Autopilot_Auth::revoke_api_key();",
    "if ($action === 'revoke') {\n            SEO_Autopilot_Outbound::notify_disconnect();\n            SEO_Autopilot_Auth::revoke_api_key();"
);
fs.writeFileSync('wordpress-plugin/seo-autopilot-connector/includes/class-seo-autopilot-admin.php', adminFile);
