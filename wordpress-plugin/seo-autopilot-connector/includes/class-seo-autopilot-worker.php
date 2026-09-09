<?php
if (!defined('ABSPATH')) { exit; }

class SEO_Autopilot_Worker {

    public static function execute_job($job) {
        try {
            $result = self::process_job($job);
            return array(
                'status' => 'completed',
                'result' => $result,
            );
        } catch (\Throwable $e) {
            error_log('[SEO Autopilot Worker] Job execution failed: ' . $e->getMessage());
            return array(
                'status' => 'failed',
                'error'  => $e->getMessage(),
            );
        }
    }

    public static function process_job($job) {
        if (empty($job['job_type'])) {
            throw new Exception('Missing job_type');
        }

        switch ($job['job_type']) {
            case 'create_post':
                return self::op_create_post($job['payload'] ?? array());
            case 'update_post':
                return self::op_update_post($job['payload'] ?? array());
            case 'upload_media':
                return self::op_upload_media($job['payload'] ?? array());
            case 'update_metadata':
                return self::op_update_metadata($job['payload'] ?? array());
            case 'add_internal_link':
                return self::op_add_internal_link($job['payload'] ?? array());
            case 'set_featured_image':
                return self::op_set_featured_image($job['payload'] ?? array());
            default:
                throw new Exception("Unknown job_type: {$job['job_type']}");
        }
    }

    private static function save_seo_meta($post_id, $payload) {
        if (!function_exists('is_plugin_active')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $seo_title = sanitize_text_field($payload['seo_title'] ?? '');
        $meta_desc = sanitize_textarea_field($payload['meta_description'] ?? '');
        $focus_kw  = sanitize_text_field($payload['focus_keyword'] ?? $payload['primary_keyword'] ?? '');
        $canonical = esc_url_raw($payload['canonical_url'] ?? '');

        // Unconditional persistence ensures Rank Math / Yoast / AIOSEO find it immediately
        if ($focus_kw) {
            update_post_meta($post_id, 'rank_math_focus_keyword', $focus_kw);
            update_post_meta($post_id, '_yoast_wpseo_focuskw', $focus_kw);
            update_post_meta($post_id, '_aioseo_keywords', $focus_kw);
        }
        if ($seo_title) {
            update_post_meta($post_id, 'rank_math_title', $seo_title);
            update_post_meta($post_id, '_yoast_wpseo_title', $seo_title);
            update_post_meta($post_id, '_aioseo_title', $seo_title);
        }
        if ($meta_desc) {
            update_post_meta($post_id, 'rank_math_description', $meta_desc);
            update_post_meta($post_id, '_yoast_wpseo_metadesc', $meta_desc);
            update_post_meta($post_id, '_aioseo_description', $meta_desc);
        }
        if ($canonical) {
            update_post_meta($post_id, 'rank_math_canonical_url', $canonical);
            update_post_meta($post_id, '_yoast_wpseo_canonical', $canonical);
        }
    }

    /**
     * Automatically sets the featured image for a post.
     * Sideloads remote URLs into WordPress media library if needed, or converts base64 data URIs.
     * Checks if image already exists to prevent duplicate media library uploads.
     */
    public static function auto_set_featured_image($post_id, $payload, $content = '') {
        if (!$post_id) return 0;

        // If post already has a featured image and overwrite is not requested, keep it
        if (has_post_thumbnail($post_id) && empty($payload['force_featured_image'])) {
            return (int)get_post_thumbnail_id($post_id);
        }

        // 1. Direct attachment ID passed
        if (!empty($payload['featured_media'])) {
            $media_id = (int)$payload['featured_media'];
            if ($media_id > 0) {
                set_post_thumbnail($post_id, $media_id);
                return $media_id;
            }
        }

        // 2. Direct image URL passed in payload
        $img_url = $payload['featured_image_url'] ?? $payload['image_url'] ?? $payload['featured_image'] ?? '';

        // 3. Fallback: Extract first image from content
        if (empty($img_url) && !empty($content)) {
            if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/i', $content, $m)) {
                $img_url = $m[1];
            } elseif (preg_match('/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/i', $content, $m)) {
                $img_url = $m[1];
            }
        }

        if (empty($img_url)) {
            return 0;
        }

        $title = sanitize_text_field($payload['title'] ?? get_the_title($post_id) ?? 'Featured Image');
        $alt   = sanitize_text_field($payload['focus_keyword'] ?? $payload['primary_keyword'] ?? $title);

        // Case A: Base64 data URI
        if (strpos($img_url, 'data:image/') === 0) {
            $semicolon = strpos($img_url, ';base64,');
            if ($semicolon !== false) {
                $ext = substr($img_url, 11, $semicolon - 11);
                $base64 = substr($img_url, $semicolon + 8);
                $decoded = base64_decode($base64);
                if ($decoded) {
                    $filename = 'featured-' . $post_id . '-' . substr(md5(uniqid()), 0, 6) . '.' . ($ext === 'jpeg' ? 'jpg' : $ext);
                    $upload = wp_upload_bits($filename, null, $decoded);
                    if (empty($upload['error']) && !empty($upload['file'])) {
                        $wp_filetype = wp_check_filetype($filename, null);
                        $attachment = array(
                            'post_mime_type' => $wp_filetype['type'],
                            'post_title'     => sanitize_file_name($title),
                            'post_content'   => '',
                            'post_status'    => 'inherit'
                        );
                        $attach_id = wp_insert_attachment($attachment, $upload['file'], $post_id);
                        if (!function_exists('wp_generate_attachment_metadata')) {
                            require_once ABSPATH . 'wp-admin/includes/image.php';
                        }
                        if ($attach_id && !is_wp_error($attach_id)) {
                            $attach_data = wp_generate_attachment_metadata($attach_id, $upload['file']);
                            wp_update_attachment_metadata($attach_id, $attach_data);
                            update_post_meta($attach_id, '_wp_attachment_image_alt', $alt);
                            set_post_thumbnail($post_id, $attach_id);
                            return (int)$attach_id;
                        }
                    }
                }
            }
        }

        // Case B: Remote HTTP/HTTPS URL
        if (filter_var($img_url, FILTER_VALIDATE_URL)) {
            global $wpdb;
            $existing_id = $wpdb->get_var($wpdb->prepare("SELECT ID FROM $wpdb->posts WHERE guid = %s AND post_type = 'attachment' LIMIT 1", $img_url));
            if ($existing_id) {
                set_post_thumbnail($post_id, (int)$existing_id);
                return (int)$existing_id;
            }

            if (!function_exists('media_sideload_image')) {
                require_once ABSPATH . 'wp-admin/includes/media.php';
                require_once ABSPATH . 'wp-admin/includes/file.php';
                require_once ABSPATH . 'wp-admin/includes/image.php';
            }

            $attach_id = media_sideload_image($img_url, $post_id, $title, 'id');
            if (!is_wp_error($attach_id) && is_numeric($attach_id)) {
                $attach_id = (int)$attach_id;
                update_post_meta($attach_id, '_wp_attachment_image_alt', $alt);
                set_post_thumbnail($post_id, $attach_id);
                return $attach_id;
            }
        }

        return 0;
    }

    private static function op_set_featured_image($payload) {
        $post_id = (int)($payload['post_id'] ?? $payload['id'] ?? 0);
        if (!$post_id || !get_post($post_id)) {
            throw new Exception("Post #{$post_id} not found.");
        }
        $post = get_post($post_id);
        $attach_id = self::auto_set_featured_image(
            $post_id,
            array_merge($payload, array('force_featured_image' => true)),
            $post->post_content
        );
        if (!$attach_id) {
            throw new Exception("Failed to set featured image for post #{$post_id}.");
        }
        return array(
            'post_id'        => $post_id,
            'featured_media' => $attach_id,
            'thumbnail_url'  => get_the_post_thumbnail_url($post_id, 'full')
        );
    }

    private static function upload_base64_safely($base64_data, $ext) {
        $decoded = base64_decode($base64_data);
        if (!$decoded) return false;
        
        $filename = 'ai-image-' . substr(md5(uniqid()), 0, 8) . '.' . ($ext === 'jpeg' ? 'jpg' : $ext);
        $upload = wp_upload_bits($filename, null, $decoded);
        
        if (empty($upload['error']) && !empty($upload['url'])) {
            $file_path = $upload['file'];
            $wp_filetype = wp_check_filetype($filename, null);
            $attachment = array(
                'post_mime_type' => $wp_filetype['type'],
                'post_title'     => sanitize_file_name($filename),
                'post_content'   => '',
                'post_status'    => 'inherit'
            );
            $attach_id = wp_insert_attachment($attachment, $file_path);
            if (!function_exists('wp_generate_attachment_metadata')) {
                require_once(ABSPATH . 'wp-admin/includes/image.php');
            }
            if ($attach_id && !is_wp_error($attach_id)) {
                $attach_data = wp_generate_attachment_metadata($attach_id, $file_path);
                wp_update_attachment_metadata($attach_id, $attach_data);
            }
            return $upload['url'];
        }
        return false;
    }

    public static function format_content_for_wp($content) {
        if (empty($content)) return $content;

        // If content is already formatted as Gutenberg blocks, return directly
        if (strpos($content, '<!-- wp:') !== false) {
            return $content;
        }
        $offset = 0;
        while (($pos = strpos($content, 'src="data:image/', $offset)) !== false) {
            $end_pos = strpos($content, '"', $pos + 16);
            if ($end_pos === false) break;
            
            $full_match = substr($content, $pos, $end_pos - $pos + 1); 
            $data_uri = substr($full_match, 5, -1); 
            
            $semicolon = strpos($data_uri, ';base64,');
            if ($semicolon !== false) {
                $ext = substr($data_uri, 11, $semicolon - 11);
                $base64 = substr($data_uri, $semicolon + 8);
                $url = self::upload_base64_safely($base64, $ext);
                if ($url) {
                    $new_src = 'src="' . esc_url($url) . '"';
                    $content = str_replace($full_match, $new_src, $content);
                    $offset = $pos + strlen($new_src);
                    continue;
                }
            }
            $offset = $end_pos;
        }

        // 2. Process Markdown image tags safely
        $offset = 0;
        while (($pos = strpos($content, '](data:image/', $offset)) !== false) {
            $start_markdown = strrpos(substr($content, 0, $pos), '![');
            if ($start_markdown === false) {
                $offset = $pos + 13;
                continue;
            }
            $end_pos = strpos($content, ')', $pos + 13);
            if ($end_pos === false) break;
            
            $full_match = substr($content, $start_markdown, $end_pos - $start_markdown + 1); 
            
            // Extract alt
            $alt_start = $start_markdown + 2;
            $alt_end = strpos($content, ']', $alt_start);
            $alt = substr($content, $alt_start, $alt_end - $alt_start);
            
            $data_uri = substr($content, $pos + 2, $end_pos - ($pos + 2));
            $semicolon = strpos($data_uri, ';base64,');
            
            if ($semicolon !== false) {
                $ext = substr($data_uri, 11, $semicolon - 11);
                $base64 = substr($data_uri, $semicolon + 8);
                
                $url = self::upload_base64_safely($base64, $ext);
                if ($url) {
                    $escaped_url = esc_url($url);
                    $escaped_alt = esc_attr($alt);
                    $caption_html = !empty($alt) ? "<figcaption class=\"wp-element-caption\">" . esc_html($alt) . "</figcaption>" : "";
                    $replacement = "\n\n<!-- wp:image " . '{"sizeSlug":"large"}' . " -->\n<figure class=\"wp-block-image size-large\"><img src=\"{$escaped_url}\" alt=\"{$escaped_alt}\"/>{$caption_html}</figure>\n<!-- /wp:image -->\n\n";
                    $content = str_replace($full_match, $replacement, $content);
                    $offset = $start_markdown + strlen($replacement);
                    continue;
                }
            }
            $offset = $end_pos;
        }

        // Convert standard Markdown Images to Gutenberg
        $content = preg_replace_callback('/!\[([^\]]*)\]\(([^)]+)\)/', function($matches) {
            $alt = esc_attr($matches[1]);
            $caption = !empty($matches[1]) ? "<figcaption class=\"wp-element-caption\">" . esc_html($matches[1]) . "</figcaption>" : "";
            $src = esc_url($matches[2]);
            return "\n\n<!-- wp:image " . '{"sizeSlug":"large"}' . " -->\n<figure class=\"wp-block-image size-large\"><img src=\"{$src}\" alt=\"{$alt}\"/>{$caption}</figure>\n<!-- /wp:image -->\n\n";
        }, $content);

        // Convert Headings safely
        $content = preg_replace_callback('/^(#{1,4})\s+(.+)$/m', function($matches) {
            $level = strlen($matches[1]);
            $title = esc_html(trim($matches[2]));
            return "\n\n<!-- wp:heading " . '{"level":' . $level . '}' . " -->\n<h{$level} class=\"wp-block-heading\">{$title}</h{$level}>\n<!-- /wp:heading -->\n\n";
        }, $content);

        // Convert Blockquotes
        $content = preg_replace_callback('/^>\s+(.+)$/m', function($matches) {
            $quote = esc_html(trim($matches[1]));
            return "\n\n<!-- wp:quote -->\n<blockquote class=\"wp-block-quote\"><p>{$quote}</p></blockquote>\n<!-- /wp:quote -->\n\n";
        }, $content);

        // Convert Horizontal Rules
        $content = preg_replace('/^---$/m', "\n\n<!-- wp:separator -->\n<hr class=\"wp-block-separator has-alpha-channel-opacity\"/>\n<!-- /wp:separator -->\n\n", $content);

        // Convert Unordered Lists
        $content = preg_replace_callback('/((?:^[*-]\s+.+$\n?)+)/m', function($matches) {
            $lines = explode("\n", trim($matches[1]));
            $items = '';
            foreach ($lines as $line) {
                $line = trim(preg_replace('/^[*-]\s+/', '', $line));
                if (!empty($line)) {
                    $items .= '<li>' . esc_html($line) . '</li>';
                }
            }
            return "\n\n<!-- wp:list -->\n<ul class=\"wp-block-list\">{$items}</ul>\n<!-- /wp:list -->\n\n";
        }, $content);

        // Convert Ordered Lists
        $content = preg_replace_callback('/((?:^\d+\.\s+.+$\n?)+)/m', function($matches) {
            $lines = explode("\n", trim($matches[1]));
            $items = '';
            foreach ($lines as $line) {
                $line = trim(preg_replace('/^\d+\.\s+/', '', $line));
                if (!empty($line)) {
                    $items .= '<li>' . esc_html($line) . '</li>';
                }
            }
            return "\n\n<!-- wp:list " . '{"ordered":true}' . " -->\n<ol class=\"wp-block-list\">{$items}</ol>\n<!-- /wp:list -->\n\n";
        }, $content);

        // Convert Bold & Italic
        $content = preg_replace('/\*\*([^*]+)\*\*/', '<strong>$1</strong>', $content);
        $content = preg_replace('/\*([^*]+)\*/', '<em>$1</em>', $content);

        // Convert Markdown Links
        $content = preg_replace_callback('/(?<!!)\[([^\]]+)\]\(([^)]+)\)/', function($matches) {
            $anchor = esc_html($matches[1]);
            $href = esc_url($matches[2]);
            return "<a href=\"{$href}\">{$anchor}</a>";
        }, $content);

        // Convert Paragraphs
        $paragraphs = preg_split('/\r?\n\s*\r?\n/', $content);
        $formatted = array();
        foreach ($paragraphs as $p) {
            $p = trim($p);
            if (empty($p)) continue;
            if (strpos($p, '<!-- wp:') === 0 || strpos($p, '<h') === 0 || strpos($p, '<figure') === 0 || strpos($p, '<ul') === 0 || strpos($p, '<ol') === 0 || strpos($p, '<blockquote') === 0) {
                $formatted[] = $p;
            } else {
                $formatted[] = "<!-- wp:paragraph -->\n<p>" . nl2br($p) . "</p>\n<!-- /wp:paragraph -->";
            }
        }

        return implode("\n\n", $formatted);
    }

    private static function op_create_post($payload) {
        $title   = sanitize_text_field($payload['title'] ?? '');
        $raw_content = $payload['content'] ?? '';
        $content = self::format_content_for_wp($raw_content);
        $excerpt = sanitize_textarea_field($payload['excerpt'] ?? '');
        $slug    = sanitize_title($payload['slug'] ?? '');
        $status  = sanitize_text_field($payload['status'] ?? 'draft');

        if (empty($title) || empty($content)) {
            throw new Exception('Title and content are required to create a post.');
        }

        if (!in_array($status, array('draft', 'pending', 'publish'), true)) {
            $status = 'draft';
        }

        $post_data = array(
            'post_title'    => $title,
            'post_content'  => $content,
            'post_excerpt'  => $excerpt,
            'post_name'     => $slug,
            'post_status'   => $status,
            'post_type'     => 'post',
            'post_author'   => get_current_user_id() ?: 1,
        );

        if (!empty($payload['category_ids']) && is_array($payload['category_ids'])) {
            $post_data['post_category'] = array_map('intval', $payload['category_ids']);
        }

        if (!empty($payload['tag_ids']) && is_array($payload['tag_ids'])) {
            $post_data['tags_input'] = array_map('intval', $payload['tag_ids']);
        }

        $post_id = wp_insert_post($post_data, true);
        if (is_wp_error($post_id)) {
            throw new Exception($post_id->get_error_message());
        }

        // Automatically attach/set featured image from payload or content
        self::auto_set_featured_image($post_id, $payload, $raw_content);

        self::save_seo_meta($post_id, $payload);

        return array(
            'post_id'   => $post_id,
            'title'     => $title,
            'slug'      => get_post_field('post_name', $post_id),
            'status'    => $status,
            'permalink' => get_permalink($post_id),
        );
    }

    private static function op_update_post($payload) {
        $post_id = (int)($payload['post_id'] ?? $payload['id'] ?? 0);
        if (!$post_id || !get_post($post_id)) {
            throw new Exception("Post #{$post_id} not found.");
        }

        $update_data = array('ID' => $post_id);

        if (isset($payload['title'])) {
            $update_data['post_title'] = sanitize_text_field($payload['title']);
        }
        if (isset($payload['content'])) {
            $update_data['post_content'] = self::format_content_for_wp($payload['content']);
        }
        if (isset($payload['excerpt'])) {
            $update_data['post_excerpt'] = sanitize_textarea_field($payload['excerpt']);
        }
        if (isset($payload['slug'])) {
            $update_data['post_name'] = sanitize_title($payload['slug']);
        }
        if (isset($payload['status']) && in_array($payload['status'], array('draft', 'pending', 'publish'))) {
            $update_data['post_status'] = $payload['status'];
        }
        if (isset($payload['category_ids']) && is_array($payload['category_ids'])) {
            $update_data['post_category'] = array_map('intval', $payload['category_ids']);
        }
        if (isset($payload['tag_ids']) && is_array($payload['tag_ids'])) {
            $update_data['tags_input'] = array_map('intval', $payload['tag_ids']);
        }

        $result = wp_update_post($update_data, true);
        if (is_wp_error($result)) {
            throw new Exception($result->get_error_message());
        }

        if (isset($payload['featured_media'])) {
            if (empty($payload['featured_media'])) {
                delete_post_thumbnail($post_id);
            } else {
                set_post_thumbnail($post_id, (int)$payload['featured_media']);
            }
        } elseif (!empty($payload['featured_image_url']) || !empty($payload['image_url']) || !has_post_thumbnail($post_id)) {
            self::auto_set_featured_image($post_id, $payload, $payload['content'] ?? '');
        }

        self::save_seo_meta($post_id, $payload);

        return array(
            'post_id'   => $post_id,
            'status'    => get_post_status($post_id),
            'permalink' => get_permalink($post_id),
        );
    }

    private static function op_upload_media($payload) {
        $file_name = sanitize_file_name($payload['file_name'] ?? 'media.jpg');
        $base64    = $payload['file_data'] ?? '';

        if (empty($base64)) {
            throw new Exception('No file_data provided for upload.');
        }

        $decoded = base64_decode($base64);
        if ($decoded === false) {
            throw new Exception('Invalid base64 encoded file data.');
        }

        $upload = wp_upload_bits($file_name, null, $decoded);
        if (!empty($upload['error'])) {
            throw new Exception($upload['error']);
        }

        $file_path = $upload['file'];
        $wp_filetype = wp_check_filetype($file_name, null);

        $attachment = array(
            'post_mime_type' => $wp_filetype['type'],
            'post_title'     => preg_replace('/.[^.]+$/', '', $file_name),
            'post_content'   => '',
            'post_status'    => 'inherit'
        );

        $attach_id = wp_insert_attachment($attachment, $file_path);
        if (is_wp_error($attach_id)) {
            throw new Exception($attach_id->get_error_message());
        }

        require_once(ABSPATH . 'wp-admin/includes/image.php');
        $attach_data = wp_generate_attachment_metadata($attach_id, $file_path);
        wp_update_attachment_metadata($attach_id, $attach_data);

        if (!empty($payload['alt_text'])) {
            update_post_meta($attach_id, '_wp_attachment_image_alt', sanitize_text_field($payload['alt_text']));
        }

        return array(
            'media_id' => $attach_id,
            'url'      => wp_get_attachment_url($attach_id)
        );
    }

    private static function op_update_metadata($payload) {
        $post_id = (int)($payload['post_id'] ?? 0);
        if (!$post_id || !get_post($post_id)) {
            throw new Exception("Post #{$post_id} not found.");
        }

        $updated = array();
        foreach ($payload['meta'] as $key => $value) {
            $s_key = sanitize_key($key);
            $s_val = sanitize_text_field($value);
            update_post_meta($post_id, $s_key, $s_val);
            $updated[$s_key] = $s_val;
        }

        return array(
            'post_id' => $post_id,
            'updated' => $updated
        );
    }

    private static function op_add_internal_link($payload) {
        $source_post_id = (int)($payload['source_post_id'] ?? 0);
        $target_url     = esc_url_raw($payload['target_url'] ?? '');
        $anchor_text    = sanitize_text_field($payload['anchor_text'] ?? '');

        if (!$source_post_id || empty($target_url) || empty($anchor_text)) {
            throw new Exception('Missing required fields for internal linking.');
        }

        $post = get_post($source_post_id);
        if (!$post) {
            throw new Exception("Source post #{$source_post_id} not found.");
        }

        $content = $post->post_content;
        $pattern = '/' . preg_quote($anchor_text, '/') . '(?![^<]*>|[^<>]*</a>)/i';
        
        $link = sprintf('<a href="%s" title="%s">%s</a>', $target_url, esc_attr($anchor_text), $anchor_text);
        
        $new_content = preg_replace($pattern, $link, $content, 1, $count);

        if ($count === 0) {
            throw new Exception('Anchor text not found in source post content, or already linked.');
        }

        $result = wp_update_post(array(
            'ID' => $source_post_id,
            'post_content' => $new_content
        ), true);

        if (is_wp_error($result)) {
            throw new Exception($result->get_error_message());
        }

        return array(
            'post_id'     => $source_post_id,
            'linked_url'  => $target_url,
            'anchor_text' => $anchor_text
        );
    }
}
