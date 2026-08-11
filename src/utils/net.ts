/**
 * Guards for URLs that arrive in a request body and are then fetched by the
 * server.
 *
 * The cover-art routes take an image URL straight from the caller. Without a
 * check the dashboard becomes a proxy into whatever the host can reach — the
 * container network, a metadata service on a link-local address, another
 * service on loopback — and the response body is written into a file the API
 * will happily serve back.
 */

/** Bytes a cover image is allowed to occupy before the fetch is aborted. */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

/** Redirect hops allowed for a cover fetch. Art hosts routinely 302. */
export const MAX_IMAGE_REDIRECTS = 3;

const isPrivateIpv4 = (hostname: string): boolean => {
    const parts = hostname.split('.');
    if (parts.length !== 4) return false;

    const octets = parts.map((part) => Number(part));
    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;

    const [a, b] = octets as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    return false;
};

const isPrivateIpv6 = (hostname: string): boolean => {
    const address = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (address === '::' || address === '::1') return true;
    if (address.startsWith('fe80:')) return true; // link-local
    if (/^f[cd][0-9a-f]{2}:/.test(address)) return true; // unique local

    // ::ffff:127.0.0.1 and friends
    const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateIpv4(mapped[1]);

    return false;
};

/**
 * True when `candidate` is a plain http(s) URL that does not obviously point
 * back at the host or its private network.
 *
 * This is a best-effort check, not a complete SSRF defence: a public hostname
 * can still resolve to a private address (DNS rebinding). It is paired with a
 * per-hop re-check on redirects at the call sites.
 */
export const isPublicHttpUrl = (candidate: unknown): boolean => {
    if (typeof candidate !== 'string' || !candidate.trim()) return false;

    let parsed: URL;
    try {
        parsed = new URL(candidate);
    } catch {
        return false;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname) return false;
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
    if (isPrivateIpv4(hostname)) return false;
    if (isPrivateIpv6(hostname)) return false;

    return true;
};
