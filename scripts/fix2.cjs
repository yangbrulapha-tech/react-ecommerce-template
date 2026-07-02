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
    
    // Using a simpler string replace since regex matching HTML tags can be tricky
    // Find all <input and <textarea, and if they don't have bg-, add bg-white dark:bg-navy-950
    let lines = content.split('\n');
    let insideInput = false;
    let inputLines = [];
    let startIdx = -1;
    
    for(let i=0; i<lines.length; i++) {
        let line = lines[i];
        if (/<(input|textarea)/.test(line)) {
            insideInput = true;
            inputLines = [];
            startIdx = i;
        }
        
        if (insideInput) {
            inputLines.push(line);
            if (/>/.test(line)) {
                // End of input tag
                let fullTag = inputLines.join('\n');
                if (!fullTag.includes('bg-') && !fullTag.includes('type="file"') && !fullTag.includes("type='file'")) {
                    // It has no background class. Let's find className=" and inject
                    let newTag = fullTag.replace(/className=(["'`])/, 'className=$1bg-white dark:bg-navy-950 ');
                    // Replace the lines
                    let newLines = newTag.split('\n');
                    for(let j=0; j<newLines.length; j++) {
                        lines[startIdx + j] = newLines[j];
                    }
                }
                insideInput = false;
            }
        }
    }
    
    content = lines.join('\n');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Fixed inputs in', filePath);
    }
  }
});
