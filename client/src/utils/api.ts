export const smartFetch = async (url: string, options: RequestInit = {}) => {
    const password = sessionStorage.getItem('dashboard_password');
    if (password) {
        options.headers = {
            ...options.headers,
            'x-password': password
        };
    }

    try {
        const res = await fetch(url, options);
        if (res.status === 401) {
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        if (res.status === 429) {
            console.warn('Rate limited by server');
            return null;
        }
        return res;
    } catch (err) {
        console.error(`Fetch error for ${url}:`, err);
        return null;
    }
};

export const getQualityLabel = (quality: number | string) => {
    const q = Number(quality);
    if (q === 27) return 'Hi-Res 24/192';
    if (q === 7) return 'Hi-Res 24/96';
    if (q === 6) return 'CD 16/44.1';
    if (q === 5) return 'MP3 320';
    return 'Unknown';
};
