import ora from 'ora';
import chalk from 'chalk';
import QobuzAPI from '../api/qobuz.js';
import LyricsProvider from '../api/lyrics.js';
import * as display from '../utils/display.js';
import { Command } from 'commander';

const api = new QobuzAPI();
const lyricsProvider = new LyricsProvider();

export function registerLyricsCommand(program: Command) {
    program
        .command('lyrics')
        .alias('l')
        .description('Get lyrics for a track')
        .argument('<url>', 'Qobuz track URL or search query')
        .option('-s, --synced', 'Show only synced lyrics')
        .option('-p, --plain', 'Show only plain lyrics')
        .action(async (url, options) => {
            display.displayBanner();

            let title = '',
                artist = '',
                album = '',
                duration = 0,
                albumArtist = '';

            const parsed = api.parseUrl(url);

            const spinner = ora({
                text: display.spinnerMessage('Fetching track information...'),
                spinner: 'dots12'
            }).start();

            try {
                if (parsed && parsed.type === 'track') {
                    const result = await api.getTrack(parsed.id);
                    if (!result.success) {
                        spinner.fail(chalk.red('Failed to get track info'));
                        display.displayError(result.error || 'Unknown error');
                        process.exit(1);
                    }

                    title = result.data!.title;
                    artist = result.data!.performer?.name || '';
                    album = result.data!.album?.title || '';
                    albumArtist = (result.data!.album as any)?.artist?.name || '';
                    duration = result.data!.duration || 0;

                    spinner.succeed(chalk.green('Track found!'));
                    display.displayTrackInfo(result.data!);
                } else {
                    spinner.text = display.spinnerMessage(`Searching for "${url}"...`);

                    const searchResult = await api.search(url, 'tracks', 1);
                    if (!searchResult.success || !searchResult.data?.tracks?.items?.length) {
                        spinner.fail(chalk.red('No tracks found'));
                        process.exit(1);
                    }

                    const track = searchResult.data!.tracks!.items[0];
                    title = track.title;
                    artist = track.performer?.name || '';
                    album = track.album?.title || '';
                    albumArtist = (track.album as any)?.artist?.name || '';
                    duration = track.duration || 0;

                    spinner.succeed(chalk.green('Track found!'));
                    console.log(
                        chalk.cyan(`
🎵 ${title} - ${artist}
`)
                    );
                }

                const lyricsSpinner = ora({
                    text: display.spinnerMessage('Searching for lyrics...'),
                    spinner: 'dots12'
                }).start();

                const lyrics = await lyricsProvider.getLyrics(
                    title,
                    artist,
                    album,
                    duration,
                    albumArtist
                );

                if (lyrics.success) {
                    lyricsSpinner.succeed(chalk.green('Lyrics found!'));

                    console.log(
                        '\n' +
                        chalk.bold.magenta('🎤 Lyrics for: ') +
                        chalk.white(`${title} - ${artist}`)
                    );
                    console.log(chalk.gray('━'.repeat(50)) + '\n');

                    if (options.synced && lyrics.syncedLyrics) {
                        console.log(chalk.cyan('[Synced Lyrics]\n'));
                        lyrics.parsedLyrics?.forEach((line) => {
                            console.log(
                                chalk.gray(`[${line.timeStr}]`) + ' ' + chalk.white(line.text)
                            );
                        });
                    } else if (options.plain && lyrics.plainLyrics) {
                        console.log(chalk.cyan('[Plain Lyrics]\n'));
                        console.log(chalk.white(lyrics.plainLyrics));
                    } else {
                        if (lyrics.syncedLyrics) {
                            console.log(chalk.green('✅ Synced lyrics available'));
                            console.log(
                                chalk.gray(`   ${lyrics.parsedLyrics?.length || 0} lines\n`)
                            );
                            lyrics.parsedLyrics?.slice(0, 10).forEach((line) => {
                                console.log(
                                    chalk.gray(`[${line.timeStr}]`) + ' ' + chalk.white(line.text)
                                );
                            });
                            if ((lyrics.parsedLyrics?.length || 0) > 10) {
                                console.log(chalk.gray('\n... (use --synced for full lyrics)'));
                            }
                        }

                        if (lyrics.plainLyrics) {
                            console.log(chalk.green('\n✅ Plain lyrics available'));
                            const lines = lyrics.plainLyrics.split('\n');
                            console.log(chalk.gray(`   ${lines.length} lines\n`));
                            lines.slice(0, 10).forEach((line) => {
                                console.log(chalk.white(line));
                            });
                            if (lines.length > 10) {
                                console.log(chalk.gray('\n... (use --plain for full lyrics)'));
                            }
                        }
                    }

                    console.log('\n' + chalk.gray(`Source: ${lyrics.source}`));
                } else {
                    lyricsSpinner.warn(chalk.yellow('No lyrics found'));
                    console.log(chalk.gray('\nTry searching with a different query or track URL.'));
                }
            } catch (error: unknown) {
                spinner.fail(chalk.red('An error occurred'));
                display.displayError((error as Error).message);
                process.exit(1);
            }
        });
}
