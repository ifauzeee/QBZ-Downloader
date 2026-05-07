import crypto from 'crypto';
import os from 'os';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

const SECRET_SEED = os.hostname() + os.platform() + os.arch() + (process.env.USERDOMAIN || 'qbz-default');
const ENCRYPTION_KEY = crypto.createHash('sha256').update(SECRET_SEED).digest();

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

export function decrypt(text: string): string {
    try {
        const [ivHex, encryptedHex] = text.split(':');
        if (!ivHex || !encryptedHex) return text;

        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch {
        return text;
    }
}

export function isEncrypted(text: string): boolean {
    return text.includes(':') && text.split(':')[0].length === IV_LENGTH * 2;
}
