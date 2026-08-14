const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src', 'lib', 'agent');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix imports: restore generateObject/generateText from 'ai'
  content = content.replace(/import\s+\{([^}]+)\}\s+from\s+'\.\.\/tools\/llm';/, (match, p1) => {
    return `import { ${p1} } from 'ai';\nimport { openai } from '../tools/llm';`;
  });
  
  // Restore model: openai('model-name') in generateObject/generateText calls
  content = content.replace(/generateObject\(\{/g, 'generateObject({\n      model: openai(\'default\'),');
  content = content.replace(/generateText\(\{/g, 'generateText({\n      model: openai(\'default\'),');
  
  fs.writeFileSync(filePath, content);
}
console.log('Restored TS typings by mocking the provider instead.');
