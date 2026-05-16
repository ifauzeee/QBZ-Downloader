import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY_FILE = path.join(process.cwd(), 'data', '.secret.key');
const IV_LENGTH = 16;

let _safeStorage: any = null;
async function getSafeStorage() {
    if (_safeStorage !== null) return _safeStorage;
    if (process.versions?.electron) {
        try {
            const electron = await import('electron');
            _safeStorage = electron.safeStorage || (electron.default && (electron.default as any).safeStorage);
        } catch {
            _safeStorage = undefined;
        }
    } else {
        _safeStorage = undefined;
    }
    return _safeStorage;
}

let ENCRYPTION_KEY: Buffer | null = null;
function getOrGenerateKey(): Buffer {
    if (ENCRYPTION_KEY) return ENCRYPTION_KEY;

    if (fs.existsSync(ENCRYPTION_KEY_FILE)) {
        try {
            const keyHex = fs.readFileSync(ENCRYPTION_KEY_FILE, 'utf8');
            ENCRYPTION_KEY = Buffer.from(keyHex, 'hex');
            return ENCRYPTION_KEY;
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
    ENCRYPTION_KEY = key;
    return key;
}

export const encryptionService = {
    async encrypt(text: string): Promise<string> {
        if (!text) return text;
        
        const safeStorage = await getSafeStorage();
        
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
            const key = getOrGenerateKey();
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
            let encrypted = cipher.update(text);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            return iv.toString('hex') + ':' + encrypted.toString('hex');
        } catch (error) {
            console.error('Encryption failed:', error);
            return text;
        }
    },

    async decrypt(text: string): Promise<string> {
        if (!text) return text;

        const safeStorage = await getSafeStorage();

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

            const key = getOrGenerateKey();
            const iv = Buffer.from(textParts.shift()!, 'hex');
            const encryptedText = Buffer.from(textParts.join(':'), 'hex');
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
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

