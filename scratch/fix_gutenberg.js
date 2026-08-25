const fs = require('fs');
let content = fs.readFileSync('wordpress-plugin/seo-autopilot-connector/includes/class-seo-autopilot-worker.php', 'utf8');

// The replacement logic:
const newFormatContent = `    public static function format_content_for_wp($content) {
        if (empty($content)) return $content;

        // 1. Process HTML image tags safely without crashing PCRE
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
                    $replacement = "\n\n<!-- wp:image {\"sizeSlug\":\"large\"} -->\n<figure class=\"wp-block-image size-large\"><img src=\"$url\" alt=\"$alt\"/></figure>\n<!-- /wp:image -->\n\n";
                    $content = str_replace($full_match, $replacement, $content);
                    $offset = $start_markdown + strlen($replacement);
                    continue;
                }
            }
            $offset = $end_pos;
        }

        // Convert standard Markdown Images to Gutenberg
        $content = preg_replace_callback('/!\[([^\]]*)\]\(([^)]+)\)/', function($matches) {
            $alt = $matches[1];
            $src = $matches[2];
            return "\n\n<!-- wp:image {\"sizeSlug\":\"large\"} -->\n<figure class=\"wp-block-image size-large\"><img src=\"$src\" alt=\"$alt\"/></figure>\n<!-- /wp:image -->\n\n";
        }, $content);

        // Convert Headings
        $content = preg_replace('/^###\s+(.+)$/m', "\n\n<!-- wp:heading {\"level\":3} -->\n<h3 class=\"wp-block-heading\">$1</h3>\n<!-- /wp:heading -->\n\n", $content);
        $content = preg_replace('/^##\s+(.+)$/m', "\n\n<!-- wp:heading {\"level\":2} -->\n<h2 class=\"wp-block-heading\">$1</h2>\n<!-- /wp:heading -->\n\n", $content);
        $content = preg_replace('/^#\s+(.+)$/m', "\n\n<!-- wp:heading {\"level\":1} -->\n<h1 class=\"wp-block-heading\">$1</h1>\n<!-- /wp:heading -->\n\n", $content);

        // Convert Bold & Italic
        $content = preg_replace('/\*\*([^*]+)\*\*/', '<strong>$1</strong>', $content);
        $content = preg_replace('/\*([^*]+)\*/', '<em>$1</em>', $content);

        // Convert Paragraphs
        $paragraphs = preg_split('/\n\s*\n/', $content);
        $formatted = array();
        foreach ($paragraphs as $p) {
            $p = trim($p);
            if (empty($p)) continue;
            if (strpos($p, '<!-- wp:') === 0 || strpos($p, '<h') === 0 || strpos($p, '<figure') === 0) {
                $formatted[] = $p;
            } else {
                $formatted[] = "<!-- wp:paragraph -->\n<p>" . nl2br($p) . "</p>\n<!-- /wp:paragraph -->";
            }
        }

        return implode("\n\n", $formatted);
    }`;

// Replace the existing function
content = content.replace(/public static function format_content_for_wp\(\$content\) \{[\s\S]*?return implode\("\\n\\n", \$formatted\);\n    \}/, newFormatContent);

fs.writeFileSync('wordpress-plugin/seo-autopilot-connector/includes/class-seo-autopilot-worker.php', content);
