import chalk from 'chalk';
import { APP_VERSION } from '../constants.js';

export const printLogo = () => {
    console.clear();
    console.log(chalk.cyan('   Q O B U Z   D O W N L O A D E R'));
    const subtitle = `v${APP_VERSION} • Premium High-Res Downloader`;
    const padding = Math.max(0, Math.floor((60 - subtitle.length) / 2));
    console.log(chalk.white(' '.repeat(padding) + subtitle));
    console.log();
};

type BoxStyle = 'info' | 'error' | 'success' | 'warning';

const BOX_COLORS = {
    info: chalk.cyan,
    error: chalk.red,
    success: chalk.green,
    warning: chalk.yellow
} as const;

export const printBox = (content: string, title = '', style: BoxStyle = 'info') => {
    const paint = BOX_COLORS[style];
    console.log(paint(`${title ? `[${title}] ` : ''}${content}`));
};