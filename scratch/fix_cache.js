const fs = require('fs');
let content = fs.readFileSync('src/app/api/integrations/wordpress/plugin/version/route.ts', 'utf8');

if (!content.includes('force-dynamic')) {
  content = content.replace(
    "import { NextResponse } from 'next/server';",
    "import { NextResponse } from 'next/server';\n\nexport const dynamic = 'force-dynamic';\nexport const revalidate = 0;"
  );
  fs.writeFileSync('src/app/api/integrations/wordpress/plugin/version/route.ts', content);
}
