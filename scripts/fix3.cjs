const fs = require('fs');
const path = require('path');
function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    if(fs.statSync(dirPath).isDirectory()) walk(dirPath, callback);
    else callback(dirPath);
  });
}

const replacements = [
  { pattern: /(?<=[\\s\`"']|^)text-slate-900(?! dark:text-)/g, replacement: 'text-slate-900 dark:text-white' },
  { pattern: /(?<=[\\s\`"']|^)text-slate-800(?! dark:text-)/g, replacement: 'text-slate-800 dark:text-slate-200' },
  { pattern: /(?<=[\\s\`"']|^)text-slate-700(?! dark:text-)/g, replacement: 'text-slate-700 dark:text-slate-200' },
  { pattern: /(?<=[\\s\`"']|^)text-navy-900(?! dark:text-)/g, replacement: 'text-navy-900 dark:text-white' },
  { pattern: /(?<=[\\s\`"']|^)text-navy-950(?! dark:text-)/g, replacement: 'text-navy-950 dark:text-white' },
  { pattern: /(?<=[\\s\`"']|^)text-emerald-600(?! dark:text-)/g, replacement: 'text-emerald-600 dark:text-emerald-400' },
  { pattern: /(?<=[\\s\`"']|^)text-red-900(?! dark:text-)/g, replacement: 'text-red-900 dark:text-red-300' },
  { pattern: /(?<=[\\s\`"']|^)text-red-800(?! dark:text-)/g, replacement: 'text-red-800 dark:text-red-300' },
  { pattern: /(?<=[\\s\`"']|^)border-slate-100(?! dark:border-)/g, replacement: 'border-slate-100 dark:border-navy-700' },
  { pattern: /(?<=[\\s\`"']|^)bg-slate-50\/50(?! dark:bg-)/g, replacement: 'bg-slate-50/50 dark:bg-navy-950/50' },
  { pattern: /(?<=[\\s\`"']|^)bg-red-50\/50(?! dark:bg-)/g, replacement: 'bg-red-50/50 dark:bg-red-900/20' }
];

walk('d:/โครงงานรักมือสองเว็บ/src', function(filePath) {
  if (filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    for (let r of replacements) {
        content = content.replace(r.pattern, r.replacement);
    }
    
    // Fix any duplicates like dark:text-white dark:text-slate-200
    content = content.replace(/dark:text-[a-z0-9-]+\s+(dark:text-[a-z0-9-]+)/g, '$1');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Fixed text colors in', filePath);
    }
  }
});
