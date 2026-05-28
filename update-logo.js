const fs = require('fs');
const path = require('path');

const cssPath = 'c:/Users/admin/Desktop/Fastival-management-main/src/main/resources/static/assets/css/demo.css';
let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('.festio-logo-text')) {
  css += `

.festio-logo-text {
  font-family: var(--font-display, 'Pretendard', sans-serif);
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--color-primary, #696cff), var(--color-accent, #03c3ec));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}
`;
  fs.writeFileSync(cssPath, css);
}

function walkSync(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) walkSync(dirPath, callback);
    else callback(path.join(dir, f));
  });
}

walkSync('c:/Users/admin/Desktop/Fastival-management-main/src/main/resources/static', filepath => {
  if (filepath.endsWith('.html') || filepath.endsWith('.js')) {
    let content = fs.readFileSync(filepath, 'utf8');
    let original = content;
    // Replace all instances
    content = content.replace(/FASTIVAL O2O/g, '<span class="festio-logo-text">FESTIO</span>');
    // Fix title tags back to plain text
    content = content.replace(/<title>(.*?)<span class="festio-logo-text">FESTIO<\/span><\/title>/g, '<title>$1FESTIO</title>');
    
    // Check if it already had nested tags in sidebar.js
    content = content.replace(/<span class="app-brand-text demo menu-text fw-bold ms-2"><span class="festio-logo-text">FESTIO<\/span><\/span>/g, '<span class="app-brand-text demo menu-text fw-bold ms-2 festio-logo-text">FESTIO</span>');

    if (content !== original) {
      fs.writeFileSync(filepath, content, 'utf8');
      console.log('Updated', filepath);
    }
  }
});
