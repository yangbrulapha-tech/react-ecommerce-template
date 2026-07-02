const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('d:/โครงงานรักมือสองเว็บ/src', function(filePath) {
  if (filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Replace text-navy-900 with text-navy-900 dark:text-white
    content = content.replace(/(?<=[\s\`"']|^)text-navy-900(?=[\s\`"']|$)/g, 'text-navy-900 dark:text-white');
    
    // Fix duplicates
    content = content.replace(/(dark:text-[a-z0-9-]+)\s+\1/g, '$1');
    content = content.replace(/dark:text-white\s+dark:text-white/g, 'dark:text-white');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated navy text in', filePath);
    }
  }
});
