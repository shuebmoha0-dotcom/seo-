=== SEO Autopilot Agent Connector ===
Contributors: seoautopilot
Tags: seo, ai-agent, automation, content, rest-api
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Official secure agent connector for the SEO Autopilot SaaS platform.

== Description ==

SEO Autopilot Agent Connector provides a dedicated, scoped REST API layer for autonomous AI agents to manage SEO content, publish approved drafts, upload media, and audit technical SEO without requiring WordPress administrator passwords or core Application Passwords.

= Key Features =

* **Scoped API Credentials**: Dedicated `seo_live_*` API keys with fine-grained capability scopes (`site:read`, `content:read`, `content:write`, `media:write`, `seo:read`).
* **Draft-First Safety**: Default execution requires human approval before publishing.
* **Full SEO Plugin Integration**: Native reading/writing of metadata for Rank Math, Yoast SEO, and All in One SEO.
* **Audit & Activity Telemetry**: Detailed in-dashboard logging of all agent operations with IP addresses and HTTP statuses.
* **Rate Limiting & Revocation**: Built-in 120 req/min rate limiter with 1-click revocation and key rotation.
* **Zero Password Sharing**: Never uses or stores WordPress user passwords.

== Installation ==

1. Upload the `seo-autopilot-connector` folder to `/wp-content/plugins/` or install via **Plugins > Add New > Upload Plugin**.
2. Activate the plugin through the **Plugins** menu in WordPress.
3. Navigate to **Settings > SEO Autopilot**.
4. Click **Generate Connection Key** to create a fresh API secret.
5. Copy the generated key into your SEO Autopilot SaaS Dashboard (**Integrations > WordPress**).
6. Test and verify connection!

== REST Endpoints ==

All endpoints are scoped under `/wp-json/seo-autopilot/v1/`:

* `GET /wp-json/seo-autopilot/v1/status` - Health & status
* `GET /wp-json/seo-autopilot/v1/site` - Site structure & detected SEO plugins
* `GET /wp-json/seo-autopilot/v1/posts` - Query posts with SEO metadata
* `POST /wp-json/seo-autopilot/v1/posts` - Create draft/publish post
* `PUT /wp-json/seo-autopilot/v1/posts/{id}` - Update post & SEO meta
* `GET /wp-json/seo-autopilot/v1/pages` - Query site pages
* `POST /wp-json/seo-autopilot/v1/media` - Secure image/asset upload
* `GET /wp-json/seo-autopilot/v1/seo` - Technical SEO & sitemap diagnostics
