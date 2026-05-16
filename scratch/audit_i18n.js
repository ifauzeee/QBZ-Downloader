import fs from 'fs';
import path from 'path';

const localesDir = 'client/src/locales';
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

const enPath = path.join(localesDir, 'en.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const enKeys = Object.keys(en);

console.log(`Audit Locales (${files.length} files)`);
console.log(`Reference: en.json (${enKeys.length} keys)\n`);

files.forEach(file => {
    if (file === 'en.json') return;
    
    const filePath = path.join(localesDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const keys = Object.keys(content);
    
    const missing = enKeys.filter(k => !keys.includes(k));
    const extra = keys.filter(k => !enKeys.includes(k));
    
    if (missing.length > 0 || extra.length > 0) {
        console.log(`[${file}]`);
        if (missing.length > 0) console.log(`  Missing: ${missing.join(', ')}`);
        if (extra.length > 0) console.log(`  Extra: ${extra.join(', ')}`);
        console.log('');
    } else {
        console.log(`[${file}] OK`);
    }
});
