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
        add_action('admin_menu', array($this, 'add_admin_menu'), 9);
        add_action('admin_init', array($this, 'handle_admin_actions'));
        add_filter('plugin_action_links', array($this, 'filter_plugin_action_links'), 10, 2);
        add_action('admin_bar_menu', array($this, 'add_admin_bar_menu'), 100);
        add_action('admin_notices', array($this, 'render_setup_notice'));
    }

    public function add_admin_bar_menu($wp_admin_bar) {
        if (!current_user_can('manage_options')) return;
        $wp_admin_bar->add_node(array(
            'id'    => 'seo-autopilot-topbar',
            'title' => '⚡ SEO Autopilot',
            'href'  => admin_url('options-general.php?page=seo-autopilot-connector'),
            'meta'  => array('title' => 'SEO Autopilot Settings & Pairing'),
        ));
    }

    public function render_setup_notice() {
        $screen = get_current_screen();
        if (!$screen || !current_user_can('manage_options')) return;
        
        // Only show if not on our own settings page
        if ($screen->id === 'settings_page_seo-autopilot-connector') {
            return;
        }

        $is_paired = SEO_Autopilot_Outbound::is_paired();
        if (!$is_paired) {
            echo '<div class="notice notice-info is-dismissible" style="border-left-color: #4f46e5; padding: 12px 16px;">
                <p style="font-size: 14px; margin: 0 0 8px 0;"><strong>🚀 SEO Autopilot Agent Connector is active!</strong> Pair your site with the AI SaaS platform to start autonomous optimization.</p>
                <p style="margin: 0;"><a href="' . esc_url(admin_url('options-general.php?page=seo-autopilot-connector')) . '" class="button button-primary" style="background: #4f46e5; border-color: #4338ca;">Open SEO Autopilot Settings &rarr;</a></p>
            </div>';
        }
    }

    public function filter_plugin_action_links($links, $file) {
        if (strpos($file, 'seo-autopilot-connector') !== false) {
            $settings_link = '<a href="' . esc_url(admin_url('options-general.php?page=seo-autopilot-connector')) . '" style="font-weight: 700; color: #4f46e5;">' . __('Settings', 'seo-autopilot-connector') . '</a>';
            array_unshift($links, $settings_link);
        }
        return $links;
    }

    public function add_admin_menu() {
        // Register cleanly under Settings -> SEO Autopilot
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

        try {
            $action = sanitize_key($_POST['seo_ap_action']);

            if ($action === 'pair_saas') {
                $saas_url = esc_url_raw($_POST['seo_ap_saas_url'] ?? SEO_Autopilot_Outbound::DEFAULT_SAAS_URL);
                $user_id  = (int)($_POST['seo_ap_user_id'] ?? get_current_user_id());

                $result = SEO_Autopilot_Outbound::pair_with_saas($saas_url, $user_id);
                if (is_wp_error($result)) {
                    wp_safe_redirect(add_query_arg(array('page' => 'seo-autopilot-connector', 'error' => urlencode($result->get_error_message())), admin_url('options-general.php')));
                    exit;
                }

                wp_safe_redirect(add_query_arg(array('page' => 'seo-autopilot-connector', 'msg' => 'paired'), admin_url('options-general.php')));
                exit;
            }

            if ($action === 'sync_jobs') {
                SEO_Autopilot_Outbound::poll_and_execute_jobs();
                wp_safe_redirect(add_query_arg(array('page' => 'seo-autopilot-connector', 'msg' => 'synced'), admin_url('options-general.php')));
                exit;
            }

            if ($action === 'generate' || $action === 'rotate') {
                $user_id  = (int)($_POST['seo_ap_user_id'] ?? get_current_user_id());
                $saas_url = esc_url_raw($_POST['seo_ap_saas_url'] ?? SEO_Autopilot_Outbound::get_saas_url());
                
                $creds = SEO_Autopilot_Auth::generate_api_key($user_id);
                update_option(SEO_Autopilot_Outbound::OPTION_SECRET_KEY, $creds['raw_key']);
                SEO_Autopilot_Outbound::pair_with_saas($saas_url, $user_id);

                set_transient('seo_ap_fresh_key_' . get_current_user_id(), $creds['raw_key'], 300);
                wp_safe_redirect(add_query_arg(array('page' => 'seo-autopilot-connector', 'msg' => 'rotated'), admin_url('options-general.php')));
                exit;
            }

            if ($action === 'revoke') {
                SEO_Autopilot_Outbound::notify_disconnect();
                SEO_Autopilot_Auth::revoke_api_key();
                delete_option(SEO_Autopilot_Outbound::OPTION_SITE_ID);
                delete_option(SEO_Autopilot_Outbound::OPTION_SECRET_KEY);
                delete_option(SEO_Autopilot_Outbound::OPTION_LAST_SYNC);
                wp_safe_redirect(add_query_arg(array('page' => 'seo-autopilot-connector', 'msg' => 'revoked'), admin_url('options-general.php')));
                exit;
            }
        } catch (\Throwable $e) {
            error_log('[SEO Autopilot Admin] Action error: ' . $e->getMessage());
            wp_safe_redirect(add_query_arg(array('page' => 'seo-autopilot-connector', 'error' => urlencode($e->getMessage())), admin_url('options-general.php')));
            exit;
        }
    }

    public function render_admin_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        try {
            $is_paired   = SEO_Autopilot_Outbound::is_paired();
            $site_id     = get_option(SEO_Autopilot_Outbound::OPTION_SITE_ID, '');
            $saas_url    = SEO_Autopilot_Outbound::get_saas_url();
            $last_sync   = get_option(SEO_Autopilot_Outbound::OPTION_LAST_SYNC, '');
            $last_error  = get_option(SEO_Autopilot_Outbound::OPTION_LAST_ERROR, '');
        $info        = SEO_Autopilot_Auth::get_connection_info();
        $fresh_key   = get_transient('seo_ap_fresh_key_' . get_current_user_id());
        if ($fresh_key) {
            delete_transient('seo_ap_fresh_key_' . get_current_user_id());
        }

        $logs  = SEO_Autopilot_Activity::get_recent_logs(25);
        $users = get_users(array('role__in' => array('administrator', 'editor', 'author'), 'number' => 50));
        ?>
        <div class="wrap" style="max-width: 960px; margin-top: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            
            <?php if (isset($_GET['msg']) && $_GET['msg'] === 'paired') : ?>
                <div class="notice notice-success is-dismissible"><p><strong>✓ Connected successfully!</strong> Outbound agent is now paired and ready.</p></div>
            <?php elseif (isset($_GET['msg']) && $_GET['msg'] === 'synced') : ?>
                <div class="notice notice-success is-dismissible"><p><strong>✓ Sync complete!</strong> Checked SaaS queue for pending SEO tasks.</p></div>
            <?php elseif (isset($_GET['msg']) && $_GET['msg'] === 'rotated') : ?>
                <div class="notice notice-success is-dismissible"><p><strong>✓ Credentials rotated!</strong> Shared key updated.</p></div>
            <?php elseif (isset($_GET['msg']) && $_GET['msg'] === 'revoked') : ?>
                <div class="notice notice-warning is-dismissible"><p>Connection revoked. Agent access has been disabled.</p></div>
            <?php elseif (isset($_GET['error'])) : ?>
                <div class="notice notice-error is-dismissible"><p><strong>Connection Error:</strong> <?php echo esc_html(urldecode($_GET['error'])); ?></p></div>
            <?php endif; ?>

            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 24px;">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="background: #4f46e5; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 22px;">⚡</div>
                        <div>
                            <h1 style="font-size: 20px; font-weight: 700; margin: 0; color: #0f172a;">SEO Autopilot Agent Connector</h1>
                            <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">Outbound Reverse-Connection Architecture &bull; Version <?php echo esc_html(SEO_AUTOPILOT_VERSION); ?></p>
                        </div>
                    </div>
                    <div>
                        <?php if ($is_paired) : ?>
                            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-weight: 600; font-size: 12px; border-radius: 9999px;">
                                <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span> Outbound Connected
                            </span>
                        <?php elseif (!empty($last_error)) : ?>
                            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-weight: 600; font-size: 12px; border-radius: 9999px;">
                                <span style="width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;"></span> Connection Warning
                            </span>
                        <?php else : ?>
                            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-weight: 600; font-size: 12px; border-radius: 9999px;">
                                <span style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%;"></span> Disconnected
                            </span>
                        <?php endif; ?>
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #1e293b;">🌐 How Outbound Connection Works</h3>
                    <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.6;">
                        This WordPress site makes secure, outbound HTTPS requests to your SaaS queue. 
                        <strong>No inbound requests are required</strong>, completely bypassing Cloudflare, WAFs, and hosting firewall blocks.
                    </p>
                </div>

                <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; margin-bottom: 24px;">
                    <!-- Connection Metadata -->
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                        <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #334155;">Connection Status</h4>
                        <table style="width: 100%; font-size: 12px; color: #475569; line-height: 2;">
                            <tr>
                                <td style="font-weight: 500; width: 130px;">Architecture:</td>
                                <td style="font-weight: 600; color: #059669;">Outbound HTTPS (Reverse)</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 500;">SaaS Endpoint:</td>
                                <td><code><?php echo esc_html($saas_url); ?></code></td>
                            </tr>
                            <tr>
                                <td style="font-weight: 500;">Paired Site ID:</td>
                                <td><code><?php echo esc_html($site_id ?: 'Not Paired'); ?></code></td>
                            </tr>
                            <tr>
                                <td style="font-weight: 500;">Last Sync:</td>
                                <td><?php echo esc_html($last_sync ?: 'Never'); ?></td>
                            </tr>
                            <tr>
                                <td style="font-weight: 500;">Cron Worker:</td>
                                <td><?php echo wp_next_scheduled(SEO_Autopilot_Outbound::CRON_HOOK) ? '<span style="color:#059669;">✓ Active (Every 1m)</span>' : '<span style="color:#dc2626;">Paused</span>'; ?></td>
                            </tr>
                        </table>

                        <?php if (!empty($last_error)) : ?>
                            <div style="margin-top: 10px; padding: 8px 12px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; font-size: 11px; color: #be123c;">
                                <strong>Last Error:</strong> <?php echo esc_html($last_error); ?>
                            </div>
                        <?php endif; ?>
                    </div>

                    <!-- Allowed Safe Operations -->
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                        <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #334155;">Allowed SEO Operations</h4>
                        <ul style="margin: 0; padding: 0; list-style: none; font-size: 12px; color: #475569; line-height: 1.8;">
                            <li><span style="color: #10b981;">✓</span> <strong>create_post / update_post</strong> (Drafts & approved publishing)</li>
                            <li><span style="color: #10b981;">✓</span> <strong>update_seo_meta</strong> (Rank Math, Yoast, AIOSEO)</li>
                            <li><span style="color: #10b981;">✓</span> <strong>upload_media</strong> (Safe image sideloading)</li>
                            <li><span style="color: #10b981;">✓</span> <strong>add_internal_links</strong> (Internal anchor link injection)</li>
                            <li><span style="color: #10b981;">✓</span> <strong>sync_site_info</strong> (Metadata & health telemetry)</li>
                            <li style="color: #94a3b8; font-size: 11px; margin-top: 4px;">🛡️ <em>Arbitrary PHP / SQL execution strictly disallowed.</em></li>
                        </ul>
                    </div>
                </div>

                <!-- Actions Bar -->
                <div style="display: flex; gap: 12px; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 1px solid #f1f5f9; flex-wrap: wrap;">
                    <form method="post" style="display: inline-flex; align-items: center; gap: 8px; flex: 1;">
                        <?php wp_nonce_field('seo_ap_admin_nonce', 'seo_ap_nonce'); ?>
                        <input type="hidden" name="seo_ap_action" value="pair_saas">
                        <input type="url" name="seo_ap_saas_url" value="<?php echo esc_attr($saas_url); ?>" placeholder="https://seo-hazel-eight.vercel.app" style="font-size: 12px; height: 34px; border-radius: 6px; width: 280px;">
                        <select name="seo_ap_user_id" style="font-size: 12px; height: 34px; border-radius: 6px;">
                            <?php foreach ($users as $u) : ?>
                                <option value="<?php echo esc_attr($u->ID); ?>" <?php selected($info['user_id'], $u->ID); ?>>
                                    Author: <?php echo esc_html($u->user_login); ?> (<?php echo esc_html(implode(', ', $u->roles)); ?>)
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <button type="submit" class="button button-primary" style="background: #4f46e5; border-color: #4f46e5; height: 34px;">
                            <?php echo $is_paired ? 'Re-Connect with SaaS' : 'Connect Outbound to SaaS'; ?>
                        </button>
                    </form>

                    <div style="display: inline-flex; gap: 8px; align-items: center;">
                        <?php if ($is_paired) : ?>
                            <form method="post" style="display: inline;">
                                <?php wp_nonce_field('seo_ap_admin_nonce', 'seo_ap_nonce'); ?>
                                <input type="hidden" name="seo_ap_action" value="sync_jobs">
                                <button type="submit" class="button" style="height: 34px;">
                                    ⚡ Sync & Run Jobs Now
                                </button>
                            </form>

                            <form method="post" onsubmit="return confirm('Are you sure you want to disconnect? Agent jobs will halt.');" style="display: inline;">
                                <?php wp_nonce_field('seo_ap_admin_nonce', 'seo_ap_nonce'); ?>
                                <input type="hidden" name="seo_ap_action" value="revoke">
                                <button type="submit" class="button" style="color: #dc2626; border-color: #fca5a5; height: 34px;">
                                    Disconnect
                                </button>
                            </form>
                        <?php endif; ?>
                    </div>
                </div>
            </div>

            <!-- Activity Logs Section -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <h3 style="font-size: 15px; font-weight: 700; margin: 0 0 16px 0; color: #0f172a;">Recent Agent Activity & Executions</h3>
                <?php if (empty($logs)) : ?>
                    <p style="font-size: 12px; color: #64748b; margin: 0;">No outbound agent activity recorded yet.</p>
                <?php else : ?>
                    <table class="wp-list-table widefat fixed striped" style="font-size: 12px; border: 1px solid #f1f5f9; border-radius: 6px;">
                        <thead>
                            <tr>
                                <th style="width: 150px;">Time (UTC)</th>
                                <th style="width: 140px;">Operation</th>
                                <th style="width: 90px;">Status</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($logs as $log) : ?>
                                <tr>
                                    <td><?php echo esc_html($log['created_at']); ?></td>
                                    <td><code><?php echo esc_html($log['event_type']); ?></code></td>
                                    <td>
                                        <?php if ((int)$log['http_status'] < 400) : ?>
                                            <span style="color: #059669; font-weight: 600;">✓ OK</span>
                                        <?php else : ?>
                                            <span style="color: #dc2626; font-weight: 600;">ERR (<?php echo esc_html($log['http_status']); ?>)</span>
                                        <?php endif; ?>
                                    </td>
                                    <td><?php echo esc_html($log['message']); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
            </div>
        </div>
        <?php
        } catch (\Throwable $e) {
            echo '<div class="notice notice-error"><p><strong>SEO Autopilot Connector:</strong> An error occurred while rendering the settings page: ' . esc_html($e->getMessage()) . '</p></div>';
        }
    }
}

