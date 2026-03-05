const fs = require('fs');
const path = require('path');

const replacements = [
    { regex: /rgba\(16,\s*185,\s*129,/g, replace: 'rgba(59, 130, 246,' }, // emerald to modern blue
    { regex: /#10b981/ig, replace: '#3b82f6' }, // emerald var to blue var
    { regex: /#059669/ig, replace: '#2563eb' }, // emerald hover to blue hover
    { regex: /#0f172a/ig, replace: '#111827' }, // background primary to dark navy
    { regex: /#1e293b/ig, replace: '#1f2937' }, // background secondary
    { regex: /#334155/ig, replace: '#374151' }, // layout tertiary/borders
    { regex: /--dm-bg-primary:\s*#0f172a/g, replace: '--dm-bg-primary: #111827' },
    { regex: /--dm-bg-secondary:\s*#1e293b/g, replace: '--dm-bg-secondary: #1f2937' },
];

function processDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.css') || fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;

            for (const rule of replacements) {
                content = content.replace(rule.regex, rule.replace);
            }

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated: ${fullPath}`);
            }
        }
    }
}

processDirectory('C:\\POS\\frontend\\src');
console.log('Update complete.');
