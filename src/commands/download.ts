import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { CONFIG, getQualityName } from '../config.js';
import QobuzAPI from '../api/qobuz.js';
import DownloadService from '../services/download.js';
import * as display from '../utils/display.js';
import { parseSelection } from '../utils/input.js';
import * as prompts from './download/prompts.js';
import { telegramService } from '../services/telegram.js';
import { Command } from 'commander';

const api = new QobuzAPI();
const downloadService = new DownloadService();

interface InteractiveOptions {
    batch?: boolean;
}

export function registerDownloadCommand(program: Command) {
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

            if (options.interactive || !targetUrl) {
                const answers = await inquirer.prompt([
                    prompts.getUrlPrompt(!targetUrl),
                    prompts.getQualityPrompt(),
                    prompts.getLyricsPrompt()
                ]);

                targetUrl = targetUrl || answers.url;
                options.quality = answers.quality;
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
                    spinner.stop();
                    await downloadAlbumInteractive(parsed.id);
                } else if (parsed.type === 'track') {
                    spinner.stop();
                    await downloadTrackInteractive(parsed.id);
                } else if (parsed.type === 'playlist') {
                    spinner.stop();
                    await downloadPlaylistInteractive(parsed.id);
                } else if (parsed.type === 'artist') {
                    spinner.stop();
                    await downloadArtistInteractive(parsed.id);
                }
            } catch (error: unknown) {
                const err = error as Error;
                spinner.fail(chalk.red('An error occurred'));
                display.displayError(err.message);
                process.exit(1);
            }
        });
}

export async function downloadAlbumInteractive(
    albumId: string | number,
    options: InteractiveOptions = {}
) {
    const spinner = ora({
        text: display.spinnerMessage('Fetching album info...'),
        spinner: 'dots12'
    }).start();

    const albumInfo = await api.getAlbum(albumId);
    if (!albumInfo.success) {
        spinner.fail(chalk.red('Failed to fetch album info'));
        display.displayError(albumInfo.error || 'Unknown error');
        return;
    }

    const album = albumInfo.data;
    let bestQuality = 6;
    let qualityLabel = '💿 CD Quality (FLAC 16/44.1)';

    if (!album) {
        spinner.fail(chalk.red('Album data is missing'));
        return;
    }

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
    display.displayAlbumInfo(albumInfo.data!);
    display.displayTrackList(albumInfo.data!.tracks?.items || []);

    console.log(chalk.cyan('\n🎚️ Detected quality: ') + chalk.white.bold(qualityLabel));

    let selectedQuality = bestQuality;
    let action = 'download';

    if (CONFIG.quality.default === 'ask') {
        if (!options.batch) {
            const qualityAnswer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'quality',
                    message: chalk.cyan('🎚️ Select quality:'),
                    choices: [
                        { name: `🔥 Max Available (${qualityLabel})`, value: bestQuality },
                        { name: '💿 CD Quality (16/44.1)', value: 6 },
                        { name: '🎵 MP3 320kbps', value: 5 }
                    ],
                    default: bestQuality
                }
            ]);
            selectedQuality = qualityAnswer.quality;
        }
    } else {
        selectedQuality = CONFIG.quality.default === 'min' ? 5 :
            CONFIG.quality.default === 'max' ? bestQuality :
                (typeof CONFIG.quality.default === 'number' ? CONFIG.quality.default : bestQuality);

        if (typeof selectedQuality === 'number' && selectedQuality > bestQuality && bestQuality !== 5) {
            selectedQuality = bestQuality;
        }

        console.log(chalk.green(`ℹ️  Settings: Using configured quality (${getQualityName(selectedQuality)}).`));
    }

    if (!options.batch) {
        const confirmAnswer = await inquirer.prompt([prompts.getActionPrompt()]);
        action = confirmAnswer.action;
    }

    if (action === 'cancel') {
        console.log(chalk.yellow('\n👋 Download cancelled.\n'));
        return;
    }

    let trackIndices: number[] | undefined = undefined;

    const tracks = album?.tracks?.items || [];
    if (!tracks.length) {
        console.log(chalk.yellow('No tracks found in this album.'));
        return;
    }

    if (action === 'select') {
        const selectionAnswer = await inquirer.prompt([
            prompts.getTrackSelectionPrompt(tracks.length)
        ]);

        trackIndices = parseSelection(selectionAnswer.tracks, tracks.length);
        console.log(chalk.cyan(`\n✨ Selected ${trackIndices.length} track(s) for download.`));
    }

    console.log('\n' + chalk.cyan.bold('📥 Starting album download...\n'));
    await telegramService.sendDownloadStart(album.title, 'album', qualityLabel);

    const downloadResult = await downloadService.downloadAlbum(albumId, selectedQuality, {
        trackIndices,
        onTrackStart: (track, _num, _total) => {
            const trackNum = track.track_number.toString().padStart(2, '0');
            console.log(chalk.cyan(`\n[Track ${trackNum}] `) + chalk.white.bold(track.title));
            console.log(chalk.gray(`    Artist: ${track.performer?.name || 'Unknown'}`));
        },
        onTrackComplete: (trackResult) => {
            if (trackResult.success) {
                console.log(chalk.green('    ✅ Downloaded successfully'));
                if (trackResult.lyrics && typeof trackResult.lyrics !== 'string') {
                    const lyricsData = trackResult.lyrics as any;
                    const hasSynced = lyricsData.synced && lyricsData.synced.length > 0;
                    console.log(
                        chalk.magenta(
                            `    🎤 Lyrics embedded (${hasSynced ? 'synced' : 'unsynced'})`
                        )
                    );
                }
            } else {
                console.log(chalk.red(`    ❌ Failed: ${trackResult.error}`));
            }
        }
    });

    if (downloadResult.success) {
        await telegramService.sendDownloadComplete(
            album.title,
            downloadResult.filePath || 'Album Directory',
            {
                trackCount: downloadResult.totalTracks
            }
        );
    } else {
        await telegramService.sendError(
            'Album Download Failed',
            downloadResult.error || 'Unknown error'
        );
    }

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

export async function downloadTrackInteractive(
    trackId: string | number,
    options: InteractiveOptions = {}
) {
    const spinner = ora({
        text: display.spinnerMessage('Fetching track info...'),
        spinner: 'dots12'
    }).start();

    const trackInfo = await api.getTrack(trackId);
    if (!trackInfo.success) {
        spinner.fail(chalk.red('Failed to fetch track info'));
        display.displayError(trackInfo.error || 'Unknown error');
        return;
    }

    const track = trackInfo.data;
    let bestQuality = 6;
    let qualityLabel = '💿 CD Quality (FLAC 16/44.1)';

    const sampleRate = track!.maximum_sampling_rate || 44.1;
    const bitDepth = track!.maximum_bit_depth || 16;

    if (bitDepth > 16 || track!.hires || track!.hires_streamable) {
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
    display.displayTrackInfo(track!);

    console.log(chalk.cyan('\n🎚️ Detected quality: ') + chalk.white.bold(qualityLabel));

    let selectedQuality = bestQuality;
    let proceed = 'y';

    if (CONFIG.quality.default === 'ask') {
        if (!options.batch) {
            const choices = [{ name: `🔥 Max Available (${qualityLabel})`, value: bestQuality }];

            if (bestQuality > 6) {
                choices.push({ name: '💿 CD Quality (16/44.1)', value: 6 });
            }

            choices.push({ name: '🎵 MP3 320kbps', value: 5 });

            const qualityAnswer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'quality',
                    message: chalk.cyan('️ Select quality:'),
                    choices: choices,
                    default: bestQuality
                }
            ]);
            selectedQuality = qualityAnswer.quality;

            const confirmAnswer = await inquirer.prompt([prompts.getTrackDownloadPrompt()]);
            proceed = confirmAnswer.proceed;
        }
    } else {
        selectedQuality = CONFIG.quality.default === 'min' ? 5 :
            CONFIG.quality.default === 'max' ? bestQuality :
                (typeof CONFIG.quality.default === 'number' ? CONFIG.quality.default : bestQuality);

        if (typeof selectedQuality === 'number' && selectedQuality > bestQuality && bestQuality !== 5) {
            selectedQuality = bestQuality;
        }

        console.log(chalk.green(`ℹ️  Settings: Using configured quality (${getQualityName(selectedQuality)}).`));

        if (!options.batch) {
            const confirmAnswer = await inquirer.prompt([prompts.getTrackDownloadPrompt()]);
            proceed = confirmAnswer.proceed;
        }
    }

    if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
        console.log(chalk.yellow('\n👋 Download cancelled.\n'));
        return;
    }

    console.log('\n' + chalk.cyan.bold('📥 Starting download...\n'));
    await telegramService.sendDownloadStart(track?.title || 'Unknown Track', 'track', qualityLabel);

    const result = await downloadService.downloadTrack(trackId, selectedQuality, {
        onProgress: (phase, loaded, total) => {
            display.displayProgress(phase, loaded, total);
        }
    });

    display.stopProgress();

    if (result.success) {
        await telegramService.sendDownloadComplete(
            track?.title || 'Unknown Track',
            result.filePath || ''
        );
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

export async function downloadPlaylistInteractive(playlistId: string | number, _options = {}) {
    const spinner = ora({
        text: display.spinnerMessage('Fetching playlist info...'),
        spinner: 'dots12'
    }).start();

    const playlistInfo = await api.getPlaylist(playlistId);
    if (!playlistInfo.success) {
        spinner.fail(chalk.red('Failed to fetch playlist info'));
        display.displayError(playlistInfo.error || 'Unknown error');
        return;
    }

    const playlist = playlistInfo.data;
    if (!playlist) {
        spinner.fail(chalk.red('Playlist not found or empty'));
        return;
    }
    spinner.succeed(chalk.green('Playlist found!'));

    console.log(chalk.bold.hex('#FF00CC')('\n🎶 PLAYLIST DETAILS'));
    console.log(chalk.gray('──────────────────────────────') + '\n');
    console.log(`${chalk.bold.white(playlist.name)}`);
    console.log(`${chalk.white(playlist.description || 'No description')}\n`);
    console.log(`${chalk.green(playlist.tracks?.items?.length || 0)} tracks found\n`);

    let selectedQuality = 27;
    let proceed = true;

    if (CONFIG.quality.default === 'ask') {
        const qualityAnswer = await inquirer.prompt([
            {
                type: 'list',
                name: 'quality',
                message: chalk.cyan('🎚️ Select download quality:'),
                choices: [
                    { name: '🔥 Hi-Res 24-bit', value: 27 },
                    { name: '💿 CD Quality', value: 6 },
                    { name: '🎵 MP3 320kbps', value: 5 }
                ],
                default: 27
            }
        ]);
        selectedQuality = qualityAnswer.quality;

        const confirm = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'proceed',
                message: chalk.cyan(`Download all ${playlist.tracks?.items?.length} tracks?`),
                default: true
            }
        ]);
        proceed = confirm.proceed;
    } else {
        selectedQuality = CONFIG.quality.default === 'min' ? 5 :
            CONFIG.quality.default === 'max' ? 27 :
                (typeof CONFIG.quality.default === 'number' ? CONFIG.quality.default : 27);

        console.log(chalk.green(`ℹ️  Settings: Using configured quality (${getQualityName(selectedQuality)}).`));

        const confirm = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'proceed',
                message: chalk.cyan(`Download all ${playlist.tracks?.items?.length} tracks?`),
                default: true
            }
        ]);
        proceed = confirm.proceed;
    }

    if (!proceed) {
        console.log(chalk.yellow('\n👋 Download cancelled.\n'));
        return;
    }

    console.log('\n' + chalk.cyan.bold('📥 Starting playlist download...\n'));
    await telegramService.sendDownloadStart(
        playlist.name,
        'playlist',
        getQualityName(selectedQuality)
    );

    const result2 = await downloadService.downloadPlaylist(playlistId, selectedQuality, {
        onProgress: (phase: any, loaded: number, total?: number) => {
            display.displayProgress(phase, loaded, total);
        },
        onTrackStart: (track, num, total) => {
            console.log(chalk.cyan(`\n[${num}/${total}] `) + chalk.white.bold(track.title));
        },
        onTrackComplete: (trackResult) => {
            if (trackResult.success) {
                console.log(chalk.green('    ✅ Complete'));
            } else {
                console.log(chalk.red('    ❌ Failed'));
            }
        }
    });

    if (result2.success) {
        await telegramService.sendDownloadComplete(
            playlist.name,
            result2.filePath || 'Playlist Directory',
            {
                trackCount: result2.totalTracks
            }
        );
    } else {
        await telegramService.sendError(
            'Playlist Download Failed',
            result2.error || 'Unknown error'
        );
    }

    display.displayDownloadSummary(result2);
}

export async function downloadArtistInteractive(artistId: string | number, _options = {}) {
    const spinner = ora({
        text: display.spinnerMessage('Fetching artist info...'),
        spinner: 'dots12'
    }).start();

    const artistInfo = await api.getArtist(artistId, 0, 100);
    if (!artistInfo.success) {
        spinner.fail(chalk.red('Failed to fetch artist info'));
        display.displayError(artistInfo.error || 'Unknown error');
        return;
    }

    spinner.succeed(chalk.green('Artist found!'));
    const artist = artistInfo.data as any;
    const albums = artist.albums?.items || [];

    console.log(chalk.bold.hex('#F37335')('\n🎤 ARTIST DETAILS'));
    console.log(chalk.gray('──────────────────────────────') + '\n');
    console.log(`${chalk.bold.white(artist.name)}`);
    console.log(`${chalk.green(albums.length)} albums found\n`);

    let selectedQuality = 27;
    let proceed = true;

    if (CONFIG.quality.default === 'ask') {
        const qualityAnswer = await inquirer.prompt([
            {
                type: 'list',
                name: 'quality',
                message: chalk.cyan('🎚️ Select download quality:'),
                choices: [
                    { name: '🔥 Hi-Res 24-bit', value: 27 },
                    { name: '💿 CD Quality', value: 6 },
                    { name: '🎵 MP3 320kbps', value: 5 }
                ],
                default: 27
            }
        ]);
        selectedQuality = qualityAnswer.quality;

        const confirm = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'proceed',
                message: chalk.cyan(`Download all ${albums.length} albums by ${artist.name}?`),
                default: true
            }
        ]);
        proceed = confirm.proceed;
    } else {
        selectedQuality = CONFIG.quality.default === 'min' ? 5 :
            CONFIG.quality.default === 'max' ? 27 :
                (typeof CONFIG.quality.default === 'number' ? CONFIG.quality.default : 27);

        console.log(chalk.green(`ℹ️  Settings: Using configured quality (${getQualityName(selectedQuality)}).`));

        const confirm = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'proceed',
                message: chalk.cyan(`Download all ${albums.length} albums by ${artist.name}?`),
                default: true
            }
        ]);
        proceed = confirm.proceed;
    }

    if (!proceed) {
        console.log(chalk.yellow('\n👋 Download cancelled.\n'));
        return;
    }

    console.log('\n' + chalk.cyan.bold('📥 Starting artist discography download...\n'));
    await telegramService.sendDownloadStart(artist.name, 'artist', getQualityName(selectedQuality));

    await downloadService.downloadArtist(artistId, selectedQuality, {
        onAlbumInfo: (album) => {
            console.log(chalk.bold.yellow(`\n💿 Processing Album: ${album.title}`));
        },
        onTrackStart: (track, num, total) => {
            console.log(chalk.cyan(`  [${num}/${total}] `) + chalk.white(track.title));
        },
        onTrackComplete: (trackResult) => {
            if (trackResult.success) {
                console.log(chalk.green('    ✅ Complete'));
            } else {
                console.log(chalk.red(`    ❌ Failed: ${trackResult.error}`));
            }
        }
    });

    display.displaySuccess(`Finished downloading discography for ${artist.name}`);
}
