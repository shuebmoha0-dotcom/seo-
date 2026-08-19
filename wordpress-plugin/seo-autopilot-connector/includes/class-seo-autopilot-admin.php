<?php
/**
 * WordPress Admin Settings Page Subsystem
 *
 * @package SEO_Autopilot_Connector
 */

if (!defined('ABSPATH')) {
    exit;
}

class SEO_Autopilot_Admin {

    private static $instance = null;

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'handle_admin_actions'));
    }

    public function add_admin_menu() {
        add_options_page(
            'SEO Autopilot Agent Connector',
            'SEO Autopilot',
            'manage_options',
            'seo-autopilot-connector',
            array($this, 'render_admin_page')
        );
    }

    public function handle_admin_actions() {
        if (!isset($_POST['seo_ap_action']) || !current_user_can('manage_options')) {
            return;
        }

        check_admin_referer('seo_ap_admin_nonce', 'seo_ap_nonce');

        $action = sanitize_key($_POST['seo_ap_action']);

        if ($action === 'generate' || $action === 'rotate') {
            $user_id = (int)($_POST['seo_ap_user_id'] ?? get_current_user_id());
            $creds = SEO_Autopilot_Auth::generate_api_key($user_id);
            set_transient('seo_ap_fresh_key_' . get_current_user_id(), $creds['raw_key'], 300);
            wp_safe_redirect(add_query_arg(array('page' => 'seo-autopilot-connector', 'msg' => 'generated'), admin_url('options-general.php')));
            exit;
        }

        if ($action === 'revoke') {
            SEO_Autopilot_Auth::revoke_api_key();
            wp_safe_redirect(add_query_arg(array('page' => 'seo-autopilot-connector', 'msg' => 'revoked'), admin_url('options-general.php')));
            exit;
        }
    }

    public function render_admin_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        $info = SEO_Autopilot_Auth::get_connection_info();
        $fresh_key = get_transient('seo_ap_fresh_key_' . get_current_user_id());
        if ($fresh_key) {
            delete_transient('seo_ap_fresh_key_' . get_current_user_id());
        }

        $logs = SEO_Autopilot_Activity::get_recent_logs(20);
        $users = get_users(array('role__in' => array('administrator', 'editor', 'author'), 'number' => 50));
        ?>
        <div class="wrap" style="max-width: 900px; margin-top: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 24px;">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="background: #4f46e5; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">⚡</div>
                        <div>
                            <h1 style="font-size: 20px; font-weight: 700; margin: 0; color: #0f172a;">SEO Autopilot Agent Connector</h1>
                            <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">Version <?php echo esc_html(SEO_AUTOPILOT_VERSION); ?> &bull; REST API: <code>/wp-json/seo-autopilot/v1/</code></p>
                        </div>
                    </div>
                    <div>
                        <?php if ($info['is_connected']) : ?>
                            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-weight: 600; font-size: 12px; border-radius: 9999px;">
                                <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span> Connected
                            </span>
                        <?php else : ?>
                            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-weight: 600; font-size: 12px; border-radius: 9999px;">
                                <span style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%;"></span> <?php echo esc_html(ucfirst($info['status'])); ?>
                            </span>
                        <?php endif; ?>
                    </div>
                </div>

                <?php if (!empty($fresh_key)) : ?>
                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                        <h3 style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px; font-weight: 700;">🎉 New API Secret Key Generated!</h3>
                        <p style="margin: 0 0 10px 0; font-size: 12px; color: #1e3a8a;">
                            Copy this secret key and enter it into your <strong>SEO Autopilot SaaS Dashboard</strong>. This secret is hashed in WordPress and will never be shown again.
                        </p>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="text" id="seo_ap_raw_key" readonly value="<?php echo esc_attr($fresh_key); ?>" style="flex: 1; font-family: monospace; font-size: 13px; padding: 8px 12px; background: #ffffff; border: 1px solid #93c5fd; border-radius: 6px; color: #0f172a;">
                            <button type="button" onclick="navigator.clipboard.writeText(document.getElementById('seo_ap_raw_key').value); this.innerText='Copied!';" class="button button-primary" style="background: #4f46e5; border-color: #4f46e5;">
                                Copy Key
                            </button>
                        </div>
                    </div>
                <?php endif; ?>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                        <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #334155;">Connection Details</h4>
                        <table style="width: 100%; font-size: 12px; color: #475569; line-height: 1.8;">
                            <tr>
                                <td style="font-weight: 500;">Status:</td>
                                <td style="font-weight: 600; color: #0f172a;"><?php echo esc_html(ucfirst($info['status'])); ?></td>
                            </tr>
                            <tr>
                                <td style="font-weight: 500;">Key Identifier:</td>
                                <td><code><?php echo esc_html($info['prefix'] ?: 'None'); ?></code></td>
                            </tr>
                            <tr>
                                <td style="font-weight: 500;">Created:</td>
                                <td><?php echo esc_html($info['created_at'] ?: 'N/A'); ?></td>
                            </tr>
                            <tr>
                                <td style="font-weight: 500;">Last Used:</td>
                                <td><?php echo esc_html($info['last_used'] ?: 'Never'); ?></td>
                            </tr>
                            <tr>
                                <td style="font-weight: 500;">SSL / HTTPS:</td>
                                <td><?php echo is_ssl() ? '<span style="color:#059669;">✓ Enforced</span>' : '<span style="color:#d97706;">⚠ HTTP (HTTPS Recommended)</span>'; ?></td>
                            </tr>
                        </table>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                        <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #334155;">Active Scopes</h4>
                        <ul style="margin: 0; padding: 0; list-style: none; font-size: 12px; color: #475569; line-height: 1.8;">
                            <?php foreach (SEO_Autopilot_Auth::$available_scopes as $scope_key => $scope_desc) : 
                                $is_granted = in_array($scope_key, $info['scopes'], true);
                            ?>
                                <li style="display: flex; align-items: center; gap: 8px;">
                                    <?php if ($is_granted) : ?>
                                        <span style="color: #10b981; font-weight: bold;">✓</span>
                                        <strong style="color: #0f172a;"><?php echo esc_html($scope_key); ?></strong>
                                    <?php else : ?>
                                        <span style="color: #94a3b8;">○</span>
                                        <span style="color: #94a3b8;"><?php echo esc_html($scope_key); ?></span>
                                    <?php endif; ?>
                                </li>
                            <?php endforeach; ?>
                        </ul>
                    </div>
                </div>

                <!-- Credential Action Forms -->
                <div style="display: flex; gap: 12px; align-items: center; padding-top: 16px; border-top: 1px solid #f1f5f9;">
                    <form method="post" style="display: inline-flex; align-items: center; gap: 8px;">
                        <?php wp_nonce_field('seo_ap_admin_nonce', 'seo_ap_nonce'); ?>
                        <input type="hidden" name="seo_ap_action" value="<?php echo $info['is_connected'] ? 'rotate' : 'generate'; ?>">
                        <select name="seo_ap_user_id" style="font-size: 12px; height: 32px; border-radius: 6px;">
                            <?php foreach ($users as $u) : ?>
                                <option value="<?php echo esc_attr($u->ID); ?>" <?php selected($info['user_id'], $u->ID); ?>>
                                    User: <?php echo esc_html($u->user_login); ?> (<?php echo esc_html(implode(', ', $u->roles)); ?>)
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <button type="submit" class="button button-primary" style="background: #4f46e5; border-color: #4f46e5;">
                            <?php echo $info['is_connected'] ? 'Rotate Key' : 'Generate Connection Key'; ?>
                        </button>
                    </form>

                    <?php if ($info['is_connected']) : ?>
                        <form method="post" onsubmit="return confirm('Are you sure you want to revoke this API key? The SaaS agent will lose access immediately.');">
                            <?php wp_nonce_field('seo_ap_admin_nonce', 'seo_ap_nonce'); ?>
                            <input type="hidden" name="seo_ap_action" value="revoke">
                            <button type="submit" class="button" style="color: #dc2626; border-color: #fca5a5;">
                                Revoke Connection
                            </button>
                        </form>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Activity Logs Section -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <h3 style="font-size: 15px; font-weight: 700; margin: 0 0 16px 0; color: #0f172a;">Recent Agent Activity</h3>
                <?php if (empty($logs)) : ?>
                    <p style="font-size: 12px; color: #64748b; margin: 0;">No connector activity recorded yet.</p>
                <?php else : ?>
                    <table class="wp-list-table widefat fixed striped" style="font-size: 12px; border: 1px solid #f1f5f9; border-radius: 6px;">
                        <thead>
                            <tr>
                                <th style="width: 140px;">Time (UTC)</th>
                                <th style="width: 120px;">Operation</th>
                                <th style="width: 80px;">Status</th>
                                <th>Details</th>
                                <th style="width: 110px;">IP Address</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($logs as $log) : ?>
                                <tr>
                                    <td><?php echo esc_html($log['created_at']); ?></td>
                                    <td><code><?php echo esc_html($log['event_type']); ?></code></td>
                                    <td>
                                        <?php if ((int)$log['http_status'] < 400) : ?>
                                            <span style="color: #059669; font-weight: 600;"><?php echo esc_html($log['http_status']); ?> OK</span>
                                        <?php else : ?>
                                            <span style="color: #dc2626; font-weight: 600;"><?php echo esc_html($log['http_status']); ?> ERR</span>
                                        <?php endif; ?>
                                    </td>
                                    <td><?php echo esc_html($log['message']); ?></td>
                                    <td><code><?php echo esc_html($log['ip_address']); ?></code></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php endif; ?>
            </div>
        </div>
        <?php
    }
}
