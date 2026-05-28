const fs = require('fs');
const { execSync } = require('child_process');

['onsite-booking', 'refund', 'staff-scan'].forEach(f => {
    const p = `c:/Users/admin/Desktop/Fastival-management-main/행사/${f}.scss`;
    let c = fs.readFileSync(p, 'utf8');
    c = c.replace(/@use.*/g, '');
    const outScss = `c:/Users/admin/Desktop/Fastival-management-main/src/main/resources/static/features/payment/staff/${f}.scss`;
    fs.writeFileSync(outScss, c, 'utf8');
    const outCss = `c:/Users/admin/Desktop/Fastival-management-main/src/main/resources/static/features/payment/staff/${f}.css`;
    execSync(`npx sass ${outScss} ${outCss}`);
});
