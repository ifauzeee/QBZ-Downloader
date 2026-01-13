import chalk from 'chalk';
import * as display from '../utils/display.js';
import { Command } from 'commander';

export function registerQualityCommand(program: Command) {
    program
        .command('quality')
        .alias('q')
        .description('Show available audio quality options')
        .action(() => {
            display.displayBanner();
            display.displayQualityOptions();

            console.log('\n' + chalk.bold.cyan('💡 Usage:'));
            console.log(
                chalk.gray('  qobuz-dl download <url> -q 27   ') + chalk.white('# Hi-Res Max')
            );
            console.log(chalk.gray('  qobuz-dl download <url> -q 7    ') + chalk.white('# Hi-Res'));
            console.log(
                chalk.gray('  qobuz-dl download <url> -q 6    ') + chalk.white('# CD Quality')
            );
            console.log(
                chalk.gray('  qobuz-dl download <url> -q 5    ') + chalk.white('# MP3 320\n')
            );
        });
}
