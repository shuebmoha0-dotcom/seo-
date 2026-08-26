const fs = require('fs');
let content = fs.readFileSync('src/lib/agent/contentAgent.ts', 'utf8');

// 1. Add reflection instruction to prompt
const oldPrompt = `Write the full article now. Include the H1 at the top. Follow the heading structure. Place image markers where indicated. Make sure to provide deep, exhaustive analysis under each heading to satisfy the \${rules.word_count_min}+ word requirement.\`,`;

const newPrompt = `Before writing the article, you MUST open a <reflection> block. Inside it, explicitly confirm how you will follow the provided CONTENT RULES and how you will use the PROJECT KNOWLEDGE BASE / MEMORY as a reference.
After closing the </reflection> block, write the full article. Include the H1 at the top. Follow the heading structure. Place image markers where indicated. Make sure to provide deep, exhaustive analysis under each heading to satisfy the \${rules.word_count_min}+ word requirement.\`,`;

content = content.replace(oldPrompt, newPrompt);

// 2. Strip reflection block from the final output
const oldReturn = `      return text;
    } catch (err: any) {`;

const newReturn = `      // Strip the reflection block to ensure clean markdown
      const finalArticle = text.replace(/<reflection>[\\s\\S]*?<\\/reflection>/i, '').trim();
      return finalArticle;
    } catch (err: any) {`;

content = content.replace(oldReturn, newReturn);
fs.writeFileSync('src/lib/agent/contentAgent.ts', content);
