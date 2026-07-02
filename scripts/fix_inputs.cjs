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
    
    // For <input ... className="... "> without bg-
    content = content.replace(/(<input[^>]*className=")([^"]*)(")/g, (match, prefix, classNames, suffix) => {
      // Don't modify if it's type="file" or already has a bg- class
      if (match.includes('type="file"') || match.includes('type=\'file\'')) return match;
      if (classNames.includes('bg-')) return match;
      
      // Inject background classes
      return prefix + 'bg-white dark:bg-navy-950 ' + classNames + suffix;
    });

    // Also do the same for <textarea>
    content = content.replace(/(<textarea[^>]*className=")([^"]*)(")/g, (match, prefix, classNames, suffix) => {
      if (classNames.includes('bg-')) return match;
      return prefix + 'bg-white dark:bg-navy-950 ' + classNames + suffix;
    });

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Fixed inputs in', filePath);
    }
  }
});
