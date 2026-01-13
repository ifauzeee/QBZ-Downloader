import chalk from 'chalk';
import gradient from 'gradient-string';

export const COLORS = {
    primary: '#00F2FF',
    secondary: '#FF0099',
    success: '#00FF9D',
    warning: '#FFD700',
    error: '#FF4444',
    text: '#FFFFFF',
    subtext: '#888888',
    bg: '#1a1a1a'
};

export const GRADIENTS = {
    title: gradient([COLORS.primary, COLORS.secondary]),
    gold: gradient(['#FFD700', '#FF8C00']),
    success: gradient([COLORS.success, '#00CC7A'])
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
    music: '🎵'
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
