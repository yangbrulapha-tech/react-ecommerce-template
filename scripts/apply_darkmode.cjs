const fs = require('fs');
const path = require('path');

const replacements = {
  'bg-white': 'bg-white dark:bg-navy-900',
  'bg-slate-50': 'bg-slate-50 dark:bg-navy-950',
  'bg-slate-100': 'bg-slate-100 dark:bg-navy-800',
  'bg-slate-200': 'bg-slate-200 dark:bg-navy-700',
  'text-slate-900': 'text-slate-900 dark:text-white',
  'text-slate-800': 'text-slate-800 dark:text-slate-100',
  'text-slate-700': 'text-slate-700 dark:text-slate-200',
  'text-slate-600': 'text-slate-600 dark:text-slate-300',
  'text-slate-500': 'text-slate-500 dark:text-slate-400',
  'text-slate-400': 'text-slate-400 dark:text-slate-500',
  'border-slate-200': 'border-slate-200 dark:border-navy-700',
  'border-slate-300': 'border-slate-300 dark:border-navy-600',
};

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
    
    for (const [light, combined] of Object.entries(replacements)) {
      const escapedLight = light.replace(/[\/\.]/g, '\\$&');
      const regex = new RegExp(`(?<=[\\s\`"']|^)${escapedLight}(?=[\\s\`"']|$)`, 'g');
      
      content = content.replace(regex, combined);
    }
    
    // Clean up duplicates if the file already had dark: classes manually added (like ProductList.jsx)
    content = content.replace(/(dark:bg-[a-z0-9-]+)\s+\1/g, '$1');
    content = content.replace(/(dark:text-[a-z0-9-]+)\s+\1/g, '$1');
    content = content.replace(/(dark:border-[a-z0-9-]+)\s+\1/g, '$1');
    
    // Fix instances where manual dark mode already existed but different from our replacement
    // e.g., "bg-white dark:bg-navy-900 dark:bg-navy-800"
    content = content.replace(/dark:bg-navy-[0-9]+\s+(dark:bg-navy-[0-9]+)/g, '$1');
    content = content.replace(/dark:text-[a-z]+(?:-[0-9]+)?\s+(dark:text-[a-z]+(?:-[0-9]+)?)/g, '$1');
    content = content.replace(/dark:border-[a-z]+(?:-[0-9]+)?\s+(dark:border-[a-z]+(?:-[0-9]+)?)/g, '$1');
    
    // Add transition-colors to all bg-white occurrences to make the toggle smooth
    // We can just add transition-colors to standard containers
    content = content.replace(/className="([^"]*bg-white dark:bg-navy-900[^"]*)"/g, (match, p1) => {
      if (!p1.includes('transition-colors')) {
        return `className="${p1} transition-colors"`;
      }
      return match;
    });

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  }
});
