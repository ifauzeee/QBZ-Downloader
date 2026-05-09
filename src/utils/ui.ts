import boxen from 'boxen';
import chalk from 'chalk';
import figlet from 'figlet';
import { APP_VERSION } from '../constants.js';
import { COLORS, GRADIENTS, SYMBOLS } from './theme.js';

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

export const printHeader = (text: string) => {
    console.log('\n' + chalk.bold.hex(COLORS.primary)(` ${SYMBOLS.arrow} ${text.toUpperCase()}`));
    console.log(chalk.hex(COLORS.subtext)(SYMBOLS.line.repeat(50)));
};

export const printSection = (label: string, value: string | number) => {
    console.log(`${chalk.hex(COLORS.primary).bold(label.padEnd(15))} : ${chalk.white(value)}`);
};

export const printSuccess = (msg: string) => {
    console.log(chalk.hex(COLORS.success)(`\n ${SYMBOLS.success} ${msg}`));
};

export const printError = (msg: string) => {
    console.log(chalk.hex(COLORS.error)(`\n ${SYMBOLS.error} ${msg}`));
};

export const printWarning = (msg: string) => {
    console.log(chalk.hex(COLORS.warning)(`\n ${SYMBOLS.warning} ${msg}`));
};

export const printInfo = (msg: string) => {
    console.log(chalk.hex(COLORS.primary)(`\n ${SYMBOLS.info} ${msg}`));
};
