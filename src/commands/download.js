import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { CONFIG } from '../config.js';
import QobuzAPI from '../api/qobuz.js';
import LyricsProvider from '../api/lyrics.js';
import DownloadService from '../services/download.js';
import MetadataService from '../services/metadata.js';
import * as display from '../utils/display.js';
import { parseSelection } from '../utils/input.js';
import * as prompts from './download/prompts.js';

const api = new QobuzAPI();
const downloadService = new DownloadService();
const metadataService = new MetadataService();
const lyricsProvider = new LyricsProvider();

export function registerDownloadCommand(program) {
    program
        .command('download')
        .alias('dl')
        .description('Download tracks or albums from Qobuz')
        .argument('[url]', 'Qobuz URL or ID to download')
        .option('-q, --quality <id>', 'Audio quality (5=MP3, 6=CD, 7=Hi-Res, 27=Hi-Res Max)', '27')
        .option('-o, --output <path>', 'Output directory', './downloads')
        .option('--no-lyrics', 'Skip lyrics embedding')
        .option('--no-cover', 'Skip cover art embedding')
        .option('-i, --interactive', 'Interactive mode')
        .action(async (url, options) => {
            display.displayBanner();

            let targetUrl = url;
            let quality = parseInt(options.quality);

            if (options.interactive || !targetUrl) {
                const answers = await inquirer.prompt([
                    prompts.getUrlPrompt(!targetUrl),
                    prompts.getQualityPrompt(),
                    prompts.getLyricsPrompt()
                ]);

                targetUrl = targetUrl || answers.url;
                quality = answers.quality;
                CONFIG.metadata.embedLyrics = answers.embedLyrics;
            }

            const parsed = api.parseUrl(targetUrl);
            if (!parsed) {
                display.displayError(
                    'Invalid Qobuz URL. Please provide a valid album or track URL.'
                );
                process.exit(1);
            }

            const spinner = ora({
                text: display.spinnerMessage('Fetching information from Qobuz...'),
                spinner: 'dots12'
            }).start();

            try {
                if (parsed.type === 'album') {
                    const albumInfo = await api.getAlbum(parsed.id);
                    if (!albumInfo.success) {
                        spinner.fail(chalk.red('Failed to fetch album info'));
                        display.displayError(albumInfo.error);
                        process.exit(1);
                    }

                    spinner.succeed(chalk.green('Album found!'));
                    display.displayAlbumInfo(albumInfo.data);
                    display.displayTrackList(albumInfo.data.tracks?.items || []);

                    const confirm = await inquirer.prompt([
                        prompts.getConfirmationPrompt(quality, 'album')
                    ]);

                    if (!confirm.proceed) {
                        console.log(chalk.yellow('\n👋 Download cancelled.\n'));
                        process.exit(0);
                    }

                    console.log('\n' + chalk.cyan.bold('📥 Starting album download...\n'));

                    const result = await downloadService.downloadAlbum(parsed.id, quality, {
                        onAlbumInfo: (_album) => {},
                        onTrackStart: (track, num, total) => {
                            console.log(
                                chalk.cyan(`\n[${num}/${total}] `) + chalk.white.bold(track.title)
                            );
                            console.log(
                                chalk.gray(`    Artist: ${track.performer?.name || 'Unknown'}`)
                            );
                        },
                        onProgress: (progress) => {
                            if (progress.phase === 'downloading') {
                                display.displayProgress('downloading', progress.percent, {
                                    speed: progress.speed
                                });
                            } else if (progress.phase === 'metadata') {
                                display.displayProgress('metadata', progress.percent);
                            } else if (progress.phase === 'complete') {
                                display.displayProgress('complete', 100);
                            }
                        },
                        onTrackComplete: (trackResult, _num, _total) => {
                            if (trackResult.success) {
                                console.log(chalk.green('    ✅ Downloaded successfully'));
                                if (trackResult.lyrics) {
                                    console.log(
                                        chalk.magenta(
                                            `    🎤 Lyrics embedded (${trackResult.lyrics.syncedLyrics ? 'synced' : 'unsynced'})`
                                        )
                                    );
                                }
                                console.log(chalk.gray(`    📁 ${trackResult.filePath}`));
                            } else {
                                console.log(chalk.red(`    ❌ Failed: ${trackResult.error}`));
                            }
                        }
                    });

                    display.displayDownloadSummary(result);
                } else if (parsed.type === 'track') {
                    const trackInfo = await api.getTrack(parsed.id);
                    if (!trackInfo.success) {
                        spinner.fail(chalk.red('Failed to fetch track info'));
                        display.displayError(trackInfo.error);
                        process.exit(1);
                    }

                    spinner.succeed(chalk.green('Track found!'));
                    display.displayTrackInfo(trackInfo.data);

                    const metadata = metadataService.extractMetadata(
                        trackInfo.data,
                        trackInfo.data.album
                    );
                    display.displayMetadata(metadata);

                    const lyricsSpinner = ora({
                        text: display.spinnerMessage('Searching for lyrics...'),
                        spinner: 'dots12'
                    }).start();

                    const lyrics = await lyricsProvider.getLyrics(
                        trackInfo.data.title,
                        trackInfo.data.performer?.name || '',
                        trackInfo.data.album?.title || '',
                        trackInfo.data.duration || 0
                    );

                    if (lyrics.success) {
                        lyricsSpinner.succeed(chalk.green('Lyrics found!'));
                        display.displayLyrics(lyrics);
                    } else {
                        lyricsSpinner.warn(chalk.yellow('No lyrics found'));
                    }

                    const confirm = await inquirer.prompt([
                        prompts.getConfirmationPrompt(quality, 'track')
                    ]);

                    if (!confirm.proceed) {
                        console.log(chalk.yellow('\n👋 Download cancelled.\n'));
                        process.exit(0);
                    }

                    console.log('\n' + chalk.cyan.bold('📥 Starting track download...\n'));

                    const result = await downloadService.downloadTrack(parsed.id, quality, {
                        onProgress: (progress) => {
                            display.displayProgress(progress.phase, progress.percent, {
                                speed: progress.speed
                            });
                        }
                    });

                    if (result.success) {
                        display.displaySuccess(
                            `Track downloaded successfully!\n\n📁 ${result.filePath}`
                        );

                        console.log('\n' + chalk.bold.cyan('📋 Embedded Metadata:'));
                        display.displayMetadata(result.metadata);

                        if (result.lyrics) {
                            console.log(chalk.green('\n✅ Lyrics embedded successfully!'));
                        }
                    } else {
                        display.displayError(`Download failed: ${result.error}`);
                    }
                }
            } catch (error) {
                spinner.fail(chalk.red('An error occurred'));
                display.displayError(error.message);
                process.exit(1);
            }
        });
}

export async function downloadAlbumInteractive(albumId, options = {}) {
    const spinner = ora({
        text: display.spinnerMessage('Fetching album info...'),
        spinner: 'dots12'
    }).start();

    const albumInfo = await api.getAlbum(albumId);
    if (!albumInfo.success) {
        spinner.fail(chalk.red('Failed to fetch album info'));
        display.displayError(albumInfo.error);
        return;
    }

    const album = albumInfo.data;
    let bestQuality = 6;
    let qualityLabel = '💿 CD Quality (FLAC 16/44.1)';

    const sampleRate = album.maximum_sampling_rate || 44.1;
    const bitDepth = album.maximum_bit_depth || 16;

    if (bitDepth > 16 || album.hires || album.hires_streamable) {
        bestQuality = 27;
        if (sampleRate >= 176.4) {
            qualityLabel = `🔥 Hi-Res Max (FLAC ${bitDepth}/${sampleRate})`;
        } else {
            qualityLabel = `✨ Hi-Res (FLAC ${bitDepth}/${sampleRate})`;
        }
    } else {
        bestQuality = 6;
        qualityLabel = `💿 CD Quality (FLAC ${bitDepth}/${sampleRate})`;
    }

    spinner.succeed(chalk.green('Album found!'));
    display.displayAlbumInfo(albumInfo.data);
    display.displayTrackList(albumInfo.data.tracks?.items || []);

    console.log(chalk.cyan('\n🎚️ Detected quality: ') + chalk.white.bold(qualityLabel));

    let action = 'download';

    if (!options.batch) {
        const confirmAnswer = await inquirer.prompt([prompts.getActionPrompt()]);
        action = confirmAnswer.action;
    }

    if (action === 'cancel') {
        console.log(chalk.yellow('\n👋 Download cancelled.\n'));
        return;
    }

    let trackIndices = null;

    if (action === 'select') {
        const selectionAnswer = await inquirer.prompt([
            prompts.getTrackSelectionPrompt(album.tracks.items.length)
        ]);

        trackIndices = parseSelection(selectionAnswer.tracks, album.tracks.items.length);
        console.log(chalk.cyan(`\n✨ Selected ${trackIndices.length} track(s) for download.`));
    }

    console.log('\n' + chalk.cyan.bold('📥 Starting album download...\n'));

    const downloadResult = await downloadService.downloadAlbum(albumId, bestQuality, {
        trackIndices,
        onTrackStart: (track, num, total) => {
            console.log(chalk.cyan(`\n[${num}/${total}] `) + chalk.white.bold(track.title));
            console.log(chalk.gray(`    Artist: ${track.performer?.name || 'Unknown'}`));
        },
        onProgress: (progress) => {
            display.displayProgress(progress.phase, progress.percent, { speed: progress.speed });
        },
        onTrackComplete: (trackResult) => {
            if (trackResult.success) {
                console.log(chalk.green('    ✅ Downloaded successfully'));
                if (trackResult.lyrics) {
                    console.log(
                        chalk.magenta(
                            `    🎤 Lyrics embedded (${trackResult.lyrics.syncedLyrics ? 'synced' : 'unsynced'})`
                        )
                    );
                }
            } else {
                console.log(chalk.red(`    ❌ Failed: ${trackResult.error}`));
            }
        }
    });

    display.displayDownloadSummary(downloadResult);

    if (!options.batch) {
        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: chalk.gray('Press Enter to continue...')
            }
        ]);
    }
}

export async function downloadTrackInteractive(trackId, options = {}) {
    const spinner = ora({
        text: display.spinnerMessage('Fetching track info...'),
        spinner: 'dots12'
    }).start();

    const trackInfo = await api.getTrack(trackId);
    if (!trackInfo.success) {
        spinner.fail(chalk.red('Failed to fetch track info'));
        display.displayError(trackInfo.error);
        return;
    }

    const track = trackInfo.data;
    let bestQuality = 6;
    let qualityLabel = '💿 CD Quality (FLAC 16/44.1)';

    const sampleRate = track.maximum_sampling_rate || 44.1;
    const bitDepth = track.maximum_bit_depth || 16;

    if (bitDepth > 16 || track.hires || track.hires_streamable) {
        bestQuality = 27;
        if (sampleRate >= 176.4) {
            qualityLabel = `🔥 Hi-Res Max (FLAC ${bitDepth}/${sampleRate})`;
        } else {
            qualityLabel = `✨ Hi-Res (FLAC ${bitDepth}/${sampleRate})`;
        }
    } else {
        bestQuality = 6;
        qualityLabel = `💿 CD Quality (FLAC ${bitDepth}/${sampleRate})`;
    }

    spinner.succeed(chalk.green('Track found!'));
    display.displayTrackInfo(trackInfo.data);

    console.log(chalk.cyan('\n🎚️ Detected quality: ') + chalk.white.bold(qualityLabel));

    let proceed = 'y';

    if (!options.batch) {
        const confirmAnswer = await inquirer.prompt([prompts.getTrackDownloadPrompt()]);
        proceed = confirmAnswer.proceed;
    }

    if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
        console.log(chalk.yellow('\n👋 Download cancelled.\n'));
        return;
    }

    console.log('\n' + chalk.cyan.bold('📥 Starting download...\n'));

    const result = await downloadService.downloadTrack(trackId, bestQuality, {
        onProgress: (progress) => {
            display.displayProgress(progress.phase, progress.percent, { speed: progress.speed });
        }
    });

    if (result.success) {
        display.displaySuccess(`Track downloaded successfully!\n\n📁 ${result.filePath}`);
        if (result.lyrics) {
            console.log(chalk.green('\n✅ Lyrics embedded successfully!'));
        }
    } else {
        display.displayError(`Download failed: ${result.error}`);
    }

    if (!options.batch) {
        await inquirer.prompt([prompts.getContinuePrompt()]);
    }
}
