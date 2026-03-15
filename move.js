const fs = require('fs');
const path = require('path');

const srcDir = path.join('c:', 'Users', 'reddy', 'OneDrive', 'Desktop', 'PopCLozet-Apps', 'apps', 'rider-app', 'src');
const oldPath = path.join(srcDir, 'pages', 'contexts');
const newPath = path.join(srcDir, 'contexts');

try {
  fs.renameSync(oldPath, newPath);
  console.log('Successfully moved contexts directory');
} catch (e) {
  console.log('Error:', e.message);
}
