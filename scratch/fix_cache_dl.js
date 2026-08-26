const fs = require('fs');
let content = fs.readFileSync('src/app/api/integrations/wordpress/plugin/route.ts', 'utf8');

if (!content.includes('force-dynamic')) {
  content = content.replace(
    "import path from 'path';",
    "import path from 'path';\n\nexport const dynamic = 'force-dynamic';\nexport const revalidate = 0;"
  );
  fs.writeFileSync('src/app/api/integrations/wordpress/plugin/route.ts', content);
}
