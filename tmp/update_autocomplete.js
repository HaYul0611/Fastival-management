const fs = require('fs');
const path = require('path');

function walkSync(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const dirFile = path.join(dir, file);
    const dirent = fs.statSync(dirFile);
    if (dirent.isDirectory()) {
      if (!dirFile.includes('node_modules') && !dirFile.includes('.git')) {
        filelist = walkSync(dirFile, filelist);
      }
    } else {
      if (dirFile.endsWith('.js') || dirFile.endsWith('.html') || dirFile.endsWith('.jsx') || dirFile.endsWith('.jsp') || dirFile.endsWith('.tsx')) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
}

const files = walkSync('d:/Fastival-management-master/src/main/resources/static');
let modifiedFiles = [];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Replace existing autocomplete="off" in search inputs with autocomplete="new-password"
  content = content.replace(/(<input[^>]*id="[^"]*search[^"]*"[^>]*autocomplete=)["']off["']/gi, '$1"new-password"');
  content = content.replace(/(<input[^>]*type=["']search["'][^>]*autocomplete=)["']off["']/gi, '$1"new-password"');

  // Add autocomplete="new-password" to search inputs that don't have autocomplete attribute
  content = content.replace(/(<input[^>]*type=["']search["'])(?![^>]*autocomplete=)([^>]*>)/gi, '$1 autocomplete="new-password"$2');
  content = content.replace(/(<input[^>]*id="[^"]*search[^"]*")(?![^>]*autocomplete=)([^>]*>)/gi, '$1 autocomplete="new-password"$2');
  
  // Do the same for placeholder="*검색*"
  content = content.replace(/(<input[^>]*placeholder=["'][^"]*검색[^"]*["'])(?![^>]*autocomplete=)([^>]*>)/gi, '$1 autocomplete="new-password"$2');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    modifiedFiles.push(file.replace('d:\\Fastival-management-master\\', ''));
  }
});

console.log('Modified files:', modifiedFiles);
