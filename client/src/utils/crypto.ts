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
    return sha256(value);
}
