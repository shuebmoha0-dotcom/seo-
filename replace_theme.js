const fs = require('fs');
const path = require('path');

const files = [
  'c:\\Users\\Shueb\\Desktop\\google seo\\src\\app\\keywords\\page.tsx',
  'c:\\Users\\Shueb\\Desktop\\google seo\\src\\app\\content-planner\\page.tsx',
  'c:\\Users\\Shueb\\Desktop\\google seo\\src\\app\\image-agent\\page.tsx',
  'c:\\Users\\Shueb\\Desktop\\google seo\\src\\app\\on-page-seo\\page.tsx'
];

const replacements = [
  [/min-h-screen bg-neutral-950 text-neutral-100/g, 'min-h-screen bg-white text-neutral-900'],
  [/bg-neutral-950 border-neutral-800 text-neutral-300/g, 'bg-neutral-50 border-neutral-200 text-neutral-700'],
  [/bg-neutral-900 border-neutral-800/g, 'bg-neutral-50 border-neutral-200'],
  [/bg-neutral-950/g, 'bg-white'],
  [/bg-neutral-900\/60/g, 'bg-white'],
  [/bg-neutral-900\/80/g, 'bg-white'],
  [/bg-neutral-900\/40/g, 'bg-neutral-50'],
  [/bg-neutral-900/g, 'bg-neutral-50'],
  [/border-neutral-900/g, 'border-neutral-200'],
  [/border-neutral-800\/80/g, 'border-neutral-200'],
  [/border-neutral-800\/60/g, 'border-neutral-200'],
  [/border-neutral-800/g, 'border-neutral-200'],
  [/text-neutral-100/g, 'text-neutral-900'],
  [/text-white/g, 'text-neutral-900'],
  [/text-neutral-300/g, 'text-neutral-700'],
  [/text-neutral-400/g, 'text-neutral-500'],
  [/hover:bg-neutral-800\/80/g, 'hover:bg-neutral-100'],
  [/hover:bg-neutral-800/g, 'hover:bg-neutral-100'],
  [/hover:bg-neutral-900\/60/g, 'hover:bg-neutral-100'],
  [/hover:border-neutral-800/g, 'hover:border-neutral-300'],
  [/hover:border-neutral-700/g, 'hover:border-neutral-300'],
  [/selection:bg-indigo-500\/30/g, 'selection:bg-indigo-500/20'],
  [/backgroundColor:\s*"#171717",\s*borderColor:\s*"#262626"/g, 'backgroundColor: "#ffffff", borderColor: "#e5e7eb"'],
  [/"#525252"/g, '"#9ca3af"'],
  [/color:\s*"#fff"/g, 'color: "#111827"'],
  [/bg-red-500\/10 text-red-400 border-red-500\/20/g, 'bg-red-50 text-red-600 border-red-200'],
  [/bg-emerald-500\/10 text-emerald-400 border-emerald-500\/20/g, 'bg-emerald-50 text-emerald-600 border-emerald-200'],
  [/bg-indigo-500\/10 text-indigo-400 border-indigo-500\/20/g, 'bg-indigo-50 text-indigo-600 border-indigo-200'],
  [/bg-blue-500\/10 text-blue-400 border-blue-500\/20/g, 'bg-blue-50 text-blue-600 border-blue-200'],
  [/bg-amber-500\/10 text-amber-400 border-amber-500\/20/g, 'bg-amber-50 text-amber-600 border-amber-200'],
  [/bg-purple-500\/10 text-purple-400 border-purple-500\/20/g, 'bg-purple-50 text-purple-600 border-purple-200'],
  [/text-indigo-400/g, 'text-indigo-600']
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    for (const [pattern, replacement] of replacements) {
      content = content.replace(pattern, replacement);
    }
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  } else {
    console.log(`Skipped ${file} - does not exist`);
  }
}
