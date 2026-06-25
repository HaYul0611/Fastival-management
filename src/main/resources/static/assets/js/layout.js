export async function injectLayout() {
    const shell = document.getElementById("app-shell");
    const main = document.getElementById("main-container");
    if (!shell || !main) return;
    
    // Check if not already injected
    if (!document.getElementById("sidebar") && !document.getElementById("header")) {
        try {
            const res = await fetch('/features/user/staff/layout.html');
            const html = await res.text();
            
            // Parse the fetched HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            const aside = doc.getElementById('sidebar');
            const header = doc.getElementById('header');
            
            if (aside) shell.insertAdjacentElement('afterbegin', aside);
            if (header) main.insertAdjacentElement('afterbegin', header);
        } catch (e) {
            console.error("Failed to load layout.html", e);
        }
    }
    
    // Dynamically load layout.css if not loaded
    if (!document.querySelector('link[href="/assets/css/layout.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/assets/css/layout.css';
        document.head.appendChild(link);
    }
}
