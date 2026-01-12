import ora from 'ora';
import chalk from 'chalk';
import QobuzAPI from '../api/qobuz.js';
import LyricsProvider from '../api/lyrics.js';
import MetadataService from '../services/metadata.js';
import * as display from '../utils/display.js';

const api = new QobuzAPI();
const metadataService = new MetadataService();
const lyricsProvider = new LyricsProvider();

export function registerInfoCommand(program) {
    program
        .command('info')
        .alias('i')
        .description('Get detailed information about an album or track')
        .argument('<url>', 'Qobuz URL or ID')
        .option('-m, --metadata', 'Show complete metadata')
        .option('-l, --lyrics', 'Show lyrics')
        .action(async (url, options) => {
            display.displayBanner();

            const parsed = api.parseUrl(url);
            if (!parsed) {
                display.displayError('Invalid Qobuz URL');
                process.exit(1);
            }

            const spinner = ora({
                text: display.spinnerMessage('Fetching information...'),
                spinner: 'dots12'
            }).start();

            try {
                if (parsed.type === 'album') {
                    const result = await api.getAlbum(parsed.id);
                    if (!result.success) {
                        spinner.fail(chalk.red('Failed to get album info'));
                        display.displayError(result.error);
                        process.exit(1);
                    }

                    spinner.succeed(chalk.green('Album info retrieved!'));
                    display.displayAlbumInfo(result.data);
                    display.displayTrackList(result.data.tracks?.items || []);

                    if (result.data.credits && result.data.credits.length > 0) {
                        console.log('\n' + chalk.bold.cyan('👥 Credits:'));
                        for (const credit of result.data.credits) {
                            console.log(
                                chalk.gray(`  • ${credit.role}: `) + chalk.white(credit.name)
                            );
                        }
                    }
                } else if (parsed.type === 'track') {
                    const result = await api.getTrack(parsed.id);
                    if (!result.success) {
                        spinner.fail(chalk.red('Failed to get track info'));
                        display.displayError(result.error);
                        process.exit(1);
                    }

                    spinner.succeed(chalk.green('Track info retrieved!'));
                    display.displayTrackInfo(result.data);

                    if (options.metadata) {
                        const metadata = metadataService.extractMetadata(
                            result.data,
                            result.data.album
                        );
                        display.displayMetadata(metadata);
                    }

                    if (options.lyrics) {
                        const lyricsSpinner = ora({
                            text: display.spinnerMessage('Fetching lyrics...'),
                            spinner: 'dots12'
                        }).start();

                        const lyrics = await lyricsProvider.getLyrics(
                            result.data.title,
                            result.data.performer?.name || '',
                            result.data.album?.title || '',
                            result.data.duration || 0
                        );

                        if (lyrics.success) {
                            lyricsSpinner.succeed(chalk.green('Lyrics found!'));
                            display.displayLyrics(lyrics, 30);
                        } else {
                            lyricsSpinner.warn(chalk.yellow('No lyrics available'));
                        }
                    }
                }
            } catch (error) {
                spinner.fail(chalk.red('An error occurred'));
                display.displayError(error.message);
                process.exit(1);
            }
        });
}
