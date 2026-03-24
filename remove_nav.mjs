import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pagesDir = path.join(__dirname, 'apps', 'customer-app', 'src', 'pages');

const importRegex = /import\s+\{\s*BottomNavBar\s*\}\s+from\s+['"].*?BottomNavBar['"];?\s*\n?/g;
const tagRegex = /\s*<BottomNavBar\s*\/>/g;

const files = fs.readdirSync(pagesDir);
let count = 0;

for (const file of files) {
  if (file.endsWith('.tsx')) {
    const filePath = path.join(pagesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('BottomNavBar')) {
      let newContent = content.replace(importRegex, '');
      newContent = newContent.replace(tagRegex, '');
      
      if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Fixed ${file}`);
        count++;
      }
    }
  }
}
console.log(`Cleaned up ${count} files.`);
