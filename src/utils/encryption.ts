import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY_FILE = path.join(process.cwd(), 'data', '.secret.key');
const IV_LENGTH = 16;

// Try to get safeStorage from Electron
let safeStorage: any = null;
if (process.versions.electron) {
    try {
        const electron = await import('electron');
        safeStorage = electron.safeStorage || (electron.default && (electron.default as any).safeStorage);
    } catch {
        // Fallback to node-only mode
    }
}

const ENCRYPTION_KEY = safeStorage?.isEncryptionAvailable() ? null : getOrGenerateKey();

function getOrGenerateKey(): Buffer {
    if (fs.existsSync(ENCRYPTION_KEY_FILE)) {
        try {
            const keyHex = fs.readFileSync(ENCRYPTION_KEY_FILE, 'utf8');
            return Buffer.from(keyHex, 'hex');
        } catch {
            console.error(
                'Failed to read encryption key, generating new one. Warning: Old encrypted data will be unreadable.'
            );
        }
    }

    const key = crypto.randomBytes(32);
    try {
        const dataDir = path.dirname(ENCRYPTION_KEY_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(ENCRYPTION_KEY_FILE, key.toString('hex'), { mode: 0o600 });
    } catch (error) {
        console.error('Failed to save encryption key:', error);
    }
    return key;
}

export const encryptionService = {
    encrypt(text: string): string {
        if (!text) return text;
        
        // Use safeStorage if available
        if (safeStorage?.isEncryptionAvailable()) {
            try {
                const encrypted = safeStorage.encryptString(text);
                return 'safe:' + encrypted.toString('hex');
            } catch (error) {
                console.error('safeStorage encryption failed:', error);
            }
        }

        // Fallback to legacy encryption
        try {
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY!, iv);
            let encrypted = cipher.update(text);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            return iv.toString('hex') + ':' + encrypted.toString('hex');
        } catch (error) {
            console.error('Encryption failed:', error);
            return text;
        }
    },

    decrypt(text: string): string {
        if (!text) return text;

        // Handle safeStorage decryption
        if (text.startsWith('safe:') && safeStorage?.isEncryptionAvailable()) {
            try {
                const encryptedHex = text.substring(5);
                return safeStorage.decryptString(Buffer.from(encryptedHex, 'hex'));
            } catch (error) {
                console.error('safeStorage decryption failed:', error);
                return text;
            }
        }

        // Handle legacy decryption
        try {
            const textParts = text.split(':');
            if (textParts.length < 2) return text;

            const iv = Buffer.from(textParts.shift()!, 'hex');
            const encryptedText = Buffer.from(textParts.join(':'), 'hex');
            const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY!, iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        } catch {
            return text;
        }
    },

    isEncrypted(text: string): boolean {
        return text.startsWith('safe:') || /^[0-9a-f]{32}:[0-9a-f]+$/.test(text);
    }
};

