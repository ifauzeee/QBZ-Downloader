/**
 * Web Crypto is only exposed in secure contexts: https:// or localhost. The
 * dashboard is normally reached at http://<lan-ip>:<port> once it runs in a
 * container, and there `crypto.subtle` is undefined - so hashing throws.
 */
const hasSubtleCrypto = (): boolean =>
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle !== 'undefined';

export async function sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

export async function normalizePasswordForAuth(password: string | null): Promise<string> {
    const value = password || '';
    if (!value) return '';
    if (/^[a-f0-9]{64}$/i.test(value)) return value;

    // Fall back to the plaintext the server also accepts. It is no weaker here:
    // an origin without Web Crypto is plain http, so the password is already
    // travelling in the clear either way. Throwing instead would break login
    // entirely on exactly the deployment the container is built for.
    if (!hasSubtleCrypto()) return value;

    return sha256(value);
}
