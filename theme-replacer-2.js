const fs = require('fs');

const files = [
  'c:/Users/Shueb/Desktop/google seo/src/components/OpportunityCard.tsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    console.log(`Processing ${file}`);
    let content = fs.readFileSync(file, 'utf8');
    
    content = content.replace(/min-h-screen bg-neutral-950 text-neutral-100/g, 'min-h-screen bg-white text-neutral-900');
    content = content.replace(/bg-neutral-950\/50/g, 'bg-white');
    content = content.replace(/bg-neutral-950/g, 'bg-white');
    content = content.replace(/bg-neutral-900\/60/g, 'bg-white');
    content = content.replace(/bg-neutral-900\/80/g, 'bg-white');
    content = content.replace(/bg-neutral-900\/40/g, 'bg-neutral-50');
    content = content.replace(/bg-neutral-900/g, 'bg-neutral-50');
    content = content.replace(/bg-neutral-800\/50/g, 'bg-white');
    content = content.replace(/bg-neutral-800\/80/g, 'bg-white');
    content = content.replace(/bg-neutral-800/g, 'bg-white');
    
    // Add border and bg-white to grey card backgrounds as specified
    content = content.replace(/border-neutral-900/g, 'border-neutral-200');
    content = content.replace(/border-neutral-800\/80/g, 'border-neutral-200');
    content = content.replace(/border-neutral-800\/60/g, 'border-neutral-200');
    content = content.replace(/border-neutral-800\/50/g, 'border-neutral-200');
    content = content.replace(/border-neutral-800/g, 'border-neutral-200');
    content = content.replace(/border-neutral-700/g, 'border-neutral-200');
    
    content = content.replace(/text-neutral-100/g, 'text-neutral-900');
    content = content.replace(/text-neutral-200/g, 'text-neutral-800');
    content = content.replace(/text-neutral-300/g, 'text-neutral-700');
    content = content.replace(/text-neutral-400/g, 'text-neutral-500');
    
    // Careful with white text, just replace text-white with text-neutral-900 then fix buttons
    content = content.replace(/text-white/g, 'text-neutral-900');
    content = content.replace(/bg-indigo-600(.*?)text-neutral-900/g, 'bg-indigo-600$1text-white');
    content = content.replace(/bg-blue-600(.*?)text-neutral-900/g, 'bg-blue-600$1text-white');
    content = content.replace(/bg-violet-600(.*?)text-neutral-900/g, 'bg-violet-600$1text-white');
    content = content.replace(/bg-black(.*?)text-neutral-900/g, 'bg-black$1text-white');

    content = content.replace(/hover:bg-neutral-800\/80/g, 'hover:bg-neutral-100');
    content = content.replace(/hover:bg-neutral-800/g, 'hover:bg-neutral-100');
    content = content.replace(/hover:bg-neutral-900\/60/g, 'hover:bg-neutral-100');
    content = content.replace(/hover:bg-neutral-900/g, 'hover:bg-neutral-100');
    content = content.replace(/hover:border-neutral-800/g, 'hover:border-neutral-300');
    content = content.replace(/hover:border-neutral-700/g, 'hover:border-neutral-300');
    
    const colors = ['red', 'emerald', 'indigo', 'blue', 'amber', 'purple', 'green'];
    for (const c of colors) {
      content = content.replace(new RegExp(`bg-${c}-500\\/10`, 'g'), `bg-${c}-50`);
      content = content.replace(new RegExp(`text-${c}-400`, 'g'), `text-${c}-600`);
      content = content.replace(new RegExp(`border-${c}-500\\/20`, 'g'), `border-${c}-200`);
      content = content.replace(new RegExp(`border-${c}-500\\/30`, 'g'), `border-${c}-300`);
      content = content.replace(new RegExp(`bg-${c}-500\\/5`, 'g'), `bg-${c}-50`);
    }

    fs.writeFileSync(file, content);
  } else {
    console.log(`Skipped ${file}, not found`);
  }
}
console.log('Done');
