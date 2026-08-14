const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src', 'lib', 'agent');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Infer the agent name from the file name, e.g., contentAgent.ts -> ContentAgent
  let agentName = file.replace('.ts', '');
  agentName = agentName.charAt(0).toUpperCase() + agentName.slice(1);
  if (agentName === 'Orchestrator') agentName = 'Orchestrator';
  else if (agentName === 'TechnicalSeoAgent') agentName = 'TechnicalSEOAgent';

  // Replace AI imports with LLMProvider
  content = content.replace(/import\s*\{\s*generateObject[^}]*\}\s*from\s*'ai';/, "import { LLMProvider } from '../tools/llm';");
  content = content.replace(/import\s*\{\s*openai\s*\}\s*from\s*'\.\.\/tools\/llm';/, "");

  // Update calls
  content = content.replace(/generateObject\(\{/g, `LLMProvider.generateObject({\n      agent: '${agentName}',`);
  content = content.replace(/generateText\(\{/g, `LLMProvider.generateText({\n      agent: '${agentName}',`);
  
  // Remove the old model: openai(...) lines
  content = content.replace(/model:\s*openai\('[^']+'\),?/g, '');

  fs.writeFileSync(filePath, content);
}

console.log('Successfully refactored all agents to use LLMProvider model routing!');
