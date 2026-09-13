import boxen from 'boxen';
import chalk from 'chalk';
import figlet from 'figlet';
import { APP_VERSION } from '../constants.js';
import { GRADIENTS } from './theme.js';

export const printLogo = () => {
    console.clear();
    const logo = figlet.textSync(' Qobuz DL ', { font: 'Slant' });
    console.log(GRADIENTS.title(logo));
    const subtitle = `v${APP_VERSION} • Premium High-Res Downloader`;
    const padding = Math.max(0, Math.floor((60 - subtitle.length) / 2));
    console.log(' '.repeat(padding) + chalk.white(subtitle));
    console.log();
};

export const printBox = (content: string, title = '', style = 'info') => {
    let borderColor = 'cyan';
    if (style === 'error') borderColor = 'red';
    if (style === 'success') borderColor = 'green';
    if (style === 'warning') borderColor = 'yellow';

    console.log(
        boxen(content, {
            title: title ? chalk.bold(title) : undefined,
            titleAlignment: 'center',
            padding: 1,
            margin: { top: 1, bottom: 1 },
            borderStyle: 'round',
            borderColor: borderColor
        })
    );
};