import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, '../client/dist');
const destDir = path.resolve(__dirname, '../src/services/dashboard/public');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

console.log('Cleaning destination...');
fs.rmSync(destDir, { recursive: true, force: true });
fs.mkdirSync(destDir, { recursive: true });

function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) {
        console.error(`Source not found: ${src}`);
        return;
    }

    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
        fs.readdirSync(src).forEach(child => {
            copyRecursive(path.join(src, child), path.join(dest, child));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

console.log(`Copying from ${srcDir} to ${destDir}...`);
copyRecursive(srcDir, destDir);
console.log('UI files synced successfully!');
