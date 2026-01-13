import chalk from 'chalk';
import gradient from 'gradient-string';

export const COLORS = {
    primary: '#00F2FF',
    secondary: '#FF0099',
    tertiary: '#7000FF',
    success: '#00FF9D',
    warning: '#FFD700',
    error: '#FF4444',
    text: '#FFFFFF',
    subtext: '#A0A0A0',
    muted: '#555555',
    bg: '#1a1a1a',
    border: '#333333'
};

export const GRADIENTS = {
    title: gradient(['#00F2FF', '#0099FF', '#FF0099']),
    gold: gradient(['#FFD700', '#FF8C00']),
    success: gradient(['#00FF9D', '#00CC7A']),
    error: gradient(['#FF4444', '#CC0000']),
    sunrise: gradient(['#FF0099', '#FFD700'])
};

export const SYMBOLS = {
    info: chalk.hex(COLORS.primary)('ℹ'),
    success: chalk.hex(COLORS.success)('✔'),
    warning: chalk.hex(COLORS.warning)('⚠'),
    error: chalk.hex(COLORS.error)('✖'),
    bullet: chalk.hex(COLORS.secondary)('•'),
    arrow: chalk.hex(COLORS.primary)('➜'),
    line: '─',
    star: '★',
    music: '🎵',
    play: '▶',
    download: '📥',
    time: '⏱️',
    quality: '💎'
};

export const THEME = {
    boxStyle: {
        borderStyle: 'round' as const,
        borderColor: 'cyan',
        padding: 1,
        margin: 1,
        backgroundColor: '#111111'
    }
};
