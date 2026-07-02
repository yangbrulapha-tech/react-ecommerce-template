const fs = require('fs');
const path = require('path');
function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    if(fs.statSync(dirPath).isDirectory()) walk(dirPath, callback);
    else callback(dirPath);
  });
}
walk('d:/โครงงานรักมือสองเว็บ/src', function(filePath) {
  if (filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    content = content.replace(/(?<=[\s\`"']|^)hover:bg-slate-50(?=[\s\`"']|$)/g, 'hover:bg-slate-50 dark:hover:bg-navy-800/60');
    content = content.replace(/(dark:hover:bg-[a-z0-9-\/]+)\s+\1/g, '$1');
    if (content !== original) fs.writeFileSync(filePath, content, 'utf8');
  }
});
