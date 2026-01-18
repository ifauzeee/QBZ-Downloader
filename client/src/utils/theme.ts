export const applyAccent = (color: string) => {
    const hexToRgb = (hex: string) => {
        if (!hex.startsWith('#')) return '99, 102, 241';
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
    };
    document.documentElement.style.setProperty('--accent-rgb', hexToRgb(color));
};
