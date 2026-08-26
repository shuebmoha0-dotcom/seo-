const fs = require('fs');
let content = fs.readFileSync('src/app/content-planner/page.tsx', 'utf8');

const oldPoll = `const hasPending = drafts.some(d => d.status === "approved" || d.status === "ready_for_approval") || publishing !== null;`;
const newPoll = `const hasPending = drafts.some(d => d.status === "approved" || d.status === "ready_for_approval" || d.status === "generating" || d.status === "writing") || publishing !== null;`;

content = content.replace(oldPoll, newPoll);
fs.writeFileSync('src/app/content-planner/page.tsx', content);
