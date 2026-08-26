const fs = require('fs');
let content = fs.readFileSync('src/app/content-planner/page.tsx', 'utf8');
content = content.replace(
  'type DraftStatus = "brief_pending" | "writing" | "qa_pending" | "needs_revision" | "ready_for_approval" | "approved" | "rejected" | "published" | "draft";',
  'type DraftStatus = "brief_pending" | "writing" | "generating" | "qa_pending" | "needs_revision" | "ready_for_approval" | "approved" | "rejected" | "published" | "draft";'
);
fs.writeFileSync('src/app/content-planner/page.tsx', content);
