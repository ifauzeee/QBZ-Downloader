#!/usr/bin/env node


import 'dotenv/config';

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                                                                           ║
 * ║     ██████╗  ██████╗ ██████╗ ██╗   ██╗███████╗    ██████╗ ██╗             ║
 * ║    ██╔═══██╗██╔═══██╗██╔══██╗██║   ██║╚══███╔╝    ██╔══██╗██║             ║
 * ║    ██║   ██║██║   ██║██████╔╝██║   ██║  ███╔╝     ██║  ██║██║             ║
 * ║    ██║▄▄ ██║██║   ██║██╔══██╗██║   ██║ ███╔╝      ██║  ██║██║             ║
 * ║    ╚██████╔╝╚██████╔╝██████╔╝╚██████╔╝███████╗    ██████╔╝███████╗        ║
 * ║     ╚══▀▀═╝  ╚═════╝ ╚═════╝  ╚═════╝ ╚══════╝    ╚═════╝ ╚══════╝        ║
 * ║                                                                           ║
 * ║                   Premium Hi-Res Music Downloader CLI                     ║
 * ║                                                                           ║
 * ║   Features:                                                               ║
 * ║   • Hi-Res Audio (24-bit/192kHz)                                          ║
 * ║   • Complete Metadata Embedding                                           ║
 * ║   • Synced & Unsynced Lyrics                                              ║
 * ║   • High-Resolution Cover Art                                             ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';

import { CONFIG, getQualityEmoji, getQualityName } from './config.js';
import QobuzAPI from './api/qobuz.js';
import LyricsProvider from './api/lyrics.js';
import DownloadService from './services/download.js';
import MetadataService from './services/metadata.js';
import * as display from './utils/display.js';

const program = new Command();
const api = new QobuzAPI();
const downloadService = new DownloadService();
const metadataService = new MetadataService();
const lyricsProvider = new LyricsProvider();

// ═══════════════════════════════════════════════════════════════════
// CLI CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

program
    .name('qobuz-dl')
    .description('🎵 Premium Qobuz Downloader CLI - Hi-Res Audio with Complete Metadata & Lyrics')
    .version('1.0.0');

// ═══════════════════════════════════════════════════════════════════
// DOWNLOAD COMMAND
// ═══════════════════════════════════════════════════════════════════

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
                {
                    type: 'input',
                    name: 'url',
                    message: chalk.cyan('🔗 Enter Qobuz URL or Album/Track ID:'),
                    when: !targetUrl,
                    validate: (input) => input.length > 0 || 'Please enter a valid URL'
                },
                {
                    type: 'list',
                    name: 'quality',
                    message: chalk.cyan('🎚️ Select audio quality:'),
                    choices: [
                        { name: '🔥 Hi-Res Max (FLAC 24/192)', value: 27 },
                        { name: '✨ Hi-Res (FLAC 24/96)', value: 7 },
                        { name: '💿 CD Quality (FLAC 16/44.1)', value: 6 },
                        { name: '🎵 MP3 320kbps', value: 5 }
                    ],
                    default: 27
                },
                {
                    type: 'confirm',
                    name: 'embedLyrics',
                    message: chalk.cyan('🎤 Embed lyrics?'),
                    default: true
                }
            ]);

            targetUrl = targetUrl || answers.url;
            quality = answers.quality;
            CONFIG.metadata.embedLyrics = answers.embedLyrics;
        }


        const parsed = api.parseUrl(targetUrl);
        if (!parsed) {
            display.displayError('Invalid Qobuz URL. Please provide a valid album or track URL.');
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
                    {
                        type: 'confirm',
                        name: 'proceed',
                        message: chalk.cyan(`\n📥 Download this album in ${getQualityEmoji(quality)} ${getQualityName(quality)}?`),
                        default: true
                    }
                ]);

                if (!confirm.proceed) {
                    console.log(chalk.yellow('\n👋 Download cancelled.\n'));
                    process.exit(0);
                }


                console.log('\n' + chalk.cyan.bold('📥 Starting album download...\n'));

                let currentTrack = 0;
                const totalTracks = albumInfo.data.tracks?.items?.length || 0;

                const result = await downloadService.downloadAlbum(parsed.id, quality, {
                    onAlbumInfo: (album) => {

                    },
                    onTrackStart: (track, num, total) => {
                        currentTrack = num;
                        console.log(chalk.cyan(`\n[${num}/${total}] `) + chalk.white.bold(track.title));
                        console.log(chalk.gray(`    Artist: ${track.performer?.name || 'Unknown'}`));
                    },
                    onProgress: (progress) => {
                        if (progress.phase === 'downloading') {
                            display.displayProgress('downloading', progress.percent, { speed: progress.speed });
                        } else if (progress.phase === 'metadata') {
                            display.displayProgress('metadata', progress.percent);
                        } else if (progress.phase === 'complete') {
                            display.displayProgress('complete', 100);
                        }
                    },
                    onTrackComplete: (trackResult, num, total) => {
                        if (trackResult.success) {
                            console.log(chalk.green(`    ✅ Downloaded successfully`));
                            if (trackResult.lyrics) {
                                console.log(chalk.magenta(`    🎤 Lyrics embedded (${trackResult.lyrics.syncedLyrics ? 'synced' : 'unsynced'})`));
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


                const metadata = metadataService.extractMetadata(trackInfo.data, trackInfo.data.album);
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
                    {
                        type: 'confirm',
                        name: 'proceed',
                        message: chalk.cyan(`\n📥 Download this track in ${getQualityEmoji(quality)} ${getQualityName(quality)}?`),
                        default: true
                    }
                ]);

                if (!confirm.proceed) {
                    console.log(chalk.yellow('\n👋 Download cancelled.\n'));
                    process.exit(0);
                }


                console.log('\n' + chalk.cyan.bold('📥 Starting track download...\n'));

                const result = await downloadService.downloadTrack(parsed.id, quality, {
                    onProgress: (progress) => {
                        display.displayProgress(progress.phase, progress.percent, { speed: progress.speed });
                    }
                });

                if (result.success) {
                    display.displaySuccess(`Track downloaded successfully!\n\n📁 ${result.filePath}`);

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

// ═══════════════════════════════════════════════════════════════════
// SEARCH COMMAND
// ═══════════════════════════════════════════════════════════════════

program
    .command('search')
    .alias('s')
    .description('Search for albums, tracks, or artists on Qobuz')
    .argument('<query>', 'Search query')
    .option('-t, --type <type>', 'Search type (albums/tracks/artists)', 'albums')
    .option('-l, --limit <number>', 'Number of results', '10')
    .action(async (query, options) => {
        display.displayBanner();

        const spinner = ora({
            text: display.spinnerMessage(`Searching for "${query}"...`),
            spinner: 'dots12'
        }).start();

        try {
            const result = await api.search(query, options.type, parseInt(options.limit));

            if (!result.success) {
                spinner.fail(chalk.red('Search failed'));
                display.displayError(result.error);
                process.exit(1);
            }

            spinner.succeed(chalk.green('Search complete!'));
            display.displaySearchResults(result.data, options.type);


            if (options.type === 'albums' && result.data.albums?.items?.length > 0) {
                const choices = result.data.albums.items.map((album, i) => ({
                    name: `${i + 1}. ${album.title} - ${album.artist?.name}`,
                    value: album.id
                }));
                choices.push({ name: '❌ Cancel', value: null });

                const answer = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'albumId',
                        message: chalk.cyan('📥 Select an album to download:'),
                        choices
                    }
                ]);

                if (answer.albumId) {

                    const downloadAnswer = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'quality',
                            message: chalk.cyan('🎚️ Select quality:'),
                            choices: [
                                { name: '🔥 Hi-Res Max (24/192)', value: 27 },
                                { name: '✨ Hi-Res (24/96)', value: 7 },
                                { name: '💿 CD Quality', value: 6 },
                                { name: '🎵 MP3 320', value: 5 }
                            ],
                            default: 27
                        }
                    ]);

                    console.log('\n' + chalk.cyan.bold('📥 Starting download...\n'));

                    const downloadResult = await downloadService.downloadAlbum(answer.albumId, downloadAnswer.quality, {
                        onTrackStart: (track, num, total) => {
                            console.log(chalk.cyan(`\n[${num}/${total}] `) + chalk.white.bold(track.title));
                        },
                        onProgress: (progress) => {
                            display.displayProgress(progress.phase, progress.percent, { speed: progress.speed });
                        },
                        onTrackComplete: (trackResult) => {
                            if (trackResult.success) {
                                console.log(chalk.green(`    ✅ Complete`));
                            } else {
                                console.log(chalk.red(`    ❌ Failed`));
                            }
                        }
                    });

                    display.displayDownloadSummary(downloadResult);
                }
            }

        } catch (error) {
            spinner.fail(chalk.red('An error occurred'));
            display.displayError(error.message);
            process.exit(1);
        }
    });

// ═══════════════════════════════════════════════════════════════════
// INFO COMMAND
// ═══════════════════════════════════════════════════════════════════

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
                        console.log(chalk.gray(`  • ${credit.role}: `) + chalk.white(credit.name));
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
                    const metadata = metadataService.extractMetadata(result.data, result.data.album);
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

// ═══════════════════════════════════════════════════════════════════
// ACCOUNT COMMAND
// ═══════════════════════════════════════════════════════════════════

program
    .command('account')
    .alias('acc')
    .description('Display account information')
    .action(async () => {
        display.displayBanner();

        const spinner = ora({
            text: display.spinnerMessage('Fetching account information...'),
            spinner: 'dots12'
        }).start();

        try {
            const result = await api.getUserInfo();

            if (!result.success) {
                spinner.fail(chalk.red('Failed to get account info'));
                display.displayError(result.error);
                process.exit(1);
            }

            spinner.succeed(chalk.green('Account info retrieved!'));
            display.displayAccountInfo(result.data);
            display.displayQualityOptions();

        } catch (error) {
            spinner.fail(chalk.red('An error occurred'));
            display.displayError(error.message);
            process.exit(1);
        }
    });

// ═══════════════════════════════════════════════════════════════════
// LYRICS COMMAND
// ═══════════════════════════════════════════════════════════════════

program
    .command('lyrics')
    .alias('l')
    .description('Get lyrics for a track')
    .argument('<url>', 'Qobuz track URL or search query')
    .option('-s, --synced', 'Show only synced lyrics')
    .option('-p, --plain', 'Show only plain lyrics')
    .action(async (url, options) => {
        display.displayBanner();

        let title, artist, album, duration;


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
                    display.displayError(result.error);
                    process.exit(1);
                }

                title = result.data.title;
                artist = result.data.performer?.name || '';
                album = result.data.album?.title || '';
                duration = result.data.duration || 0;

                spinner.succeed(chalk.green('Track found!'));
                display.displayTrackInfo(result.data);
            } else {

                spinner.text = display.spinnerMessage(`Searching for "${url}"...`);

                const searchResult = await api.search(url, 'tracks', 1);
                if (!searchResult.success || !searchResult.data.tracks?.items?.length) {
                    spinner.fail(chalk.red('No tracks found'));
                    process.exit(1);
                }

                const track = searchResult.data.tracks.items[0];
                title = track.title;
                artist = track.performer?.name || '';
                album = track.album?.title || '';
                duration = track.duration || 0;

                spinner.succeed(chalk.green('Track found!'));
                console.log(chalk.cyan(`\n🎵 ${title} - ${artist}\n`));
            }

            const lyricsSpinner = ora({
                text: display.spinnerMessage('Searching for lyrics...'),
                spinner: 'dots12'
            }).start();

            const lyrics = await lyricsProvider.getLyrics(title, artist, album, duration);

            if (lyrics.success) {
                lyricsSpinner.succeed(chalk.green('Lyrics found!'));

                console.log('\n' + chalk.bold.magenta('🎤 Lyrics for: ') + chalk.white(`${title} - ${artist}`));
                console.log(chalk.gray('━'.repeat(50)) + '\n');

                if (options.synced && lyrics.syncedLyrics) {
                    console.log(chalk.cyan('[Synced Lyrics]\n'));
                    lyrics.parsedLyrics?.forEach(line => {
                        console.log(chalk.gray(`[${line.timeStr}]`) + ' ' + chalk.white(line.text));
                    });
                } else if (options.plain && lyrics.plainLyrics) {
                    console.log(chalk.cyan('[Plain Lyrics]\n'));
                    console.log(chalk.white(lyrics.plainLyrics));
                } else {

                    if (lyrics.syncedLyrics) {
                        console.log(chalk.green('✅ Synced lyrics available'));
                        console.log(chalk.gray(`   ${lyrics.parsedLyrics?.length || 0} lines\n`));
                        lyrics.parsedLyrics?.slice(0, 10).forEach(line => {
                            console.log(chalk.gray(`[${line.timeStr}]`) + ' ' + chalk.white(line.text));
                        });
                        if ((lyrics.parsedLyrics?.length || 0) > 10) {
                            console.log(chalk.gray('\n... (use --synced for full lyrics)'));
                        }
                    }

                    if (lyrics.plainLyrics) {
                        console.log(chalk.green('\n✅ Plain lyrics available'));
                        const lines = lyrics.plainLyrics.split('\n');
                        console.log(chalk.gray(`   ${lines.length} lines\n`));
                        lines.slice(0, 10).forEach(line => {
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

        } catch (error) {
            spinner.fail(chalk.red('An error occurred'));
            display.displayError(error.message);
            process.exit(1);
        }
    });

// ═══════════════════════════════════════════════════════════════════
// QUALITY COMMAND
// ═══════════════════════════════════════════════════════════════════

program
    .command('quality')
    .alias('q')
    .description('Show available audio quality options')
    .action(() => {
        display.displayBanner();
        display.displayQualityOptions();

        console.log('\n' + chalk.bold.cyan('💡 Usage:'));
        console.log(chalk.gray('  qobuz-dl download <url> -q 27   ') + chalk.white('# Hi-Res Max'));
        console.log(chalk.gray('  qobuz-dl download <url> -q 7    ') + chalk.white('# Hi-Res'));
        console.log(chalk.gray('  qobuz-dl download <url> -q 6    ') + chalk.white('# CD Quality'));
        console.log(chalk.gray('  qobuz-dl download <url> -q 5    ') + chalk.white('# MP3 320\n'));
    });

// ═══════════════════════════════════════════════════════════════════
// INTERACTIVE MAIN MENU
// ═══════════════════════════════════════════════════════════════════

async function showMainMenu() {
    display.displayBanner();

    while (true) {
        console.log(chalk.bold.cyan('\n📋 Main Menu:\n'));
        console.log(chalk.white('  1) 🔍 Search Music'));
        console.log(chalk.white('  2) 📥 Download by URL'));
        console.log(chalk.white('  3) 👤 Account Info'));
        console.log(chalk.white('  4) 🎚️ Quality Options'));
        console.log(chalk.white('  5) ❌ Exit'));
        console.log();

        const mainChoice = await inquirer.prompt([
            {
                type: 'input',
                name: 'action',
                message: chalk.cyan('Enter your choice (1-5):'),
                validate: (input) => {
                    const num = parseInt(input);
                    if (num >= 1 && num <= 5) return true;
                    return 'Please enter a number between 1 and 5';
                }
            }
        ]);

        const actionMap = { '1': 'search', '2': 'download', '3': 'account', '4': 'quality', '5': 'exit' };
        const action = actionMap[mainChoice.action];

        if (action === 'exit') {
            console.log(chalk.yellow('\n👋 Goodbye! Happy listening! 🎧\n'));
            process.exit(0);
        }

        if (action === 'search') {
            await handleSearch();
        } else if (action === 'download') {
            await handleDownload();
        } else if (action === 'account') {
            await handleAccount();
        } else if (action === 'quality') {
            display.displayQualityOptions();
            console.log();
        }
    }
}

async function handleSearch() {
    console.log(chalk.bold.cyan('\n🔍 Search by:\n'));
    console.log(chalk.white('  1) 💿 Albums'));
    console.log(chalk.white('  2) 🎵 Tracks'));
    console.log(chalk.white('  3) 🎤 Artists'));
    console.log(chalk.white('  0) ⬅️ Back'));
    console.log();

    const searchOptions = await inquirer.prompt([
        {
            type: 'input',
            name: 'type',
            message: chalk.cyan('Enter your choice (0-3):'),
            validate: (input) => {
                const num = parseInt(input);
                if (num >= 0 && num <= 3) return true;
                return 'Please enter a number between 0 and 3';
            }
        }
    ]);

    const typeMap = { '0': 'back', '1': 'albums', '2': 'tracks', '3': 'artists' };
    const searchType = typeMap[searchOptions.type];

    if (searchType === 'back') return;

    const searchLabel = searchType === 'albums' ? 'album' : searchType === 'tracks' ? 'track' : 'artist';
    const queryAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'query',
            message: chalk.cyan(`🔎 Enter ${searchLabel} name:`),
            validate: (input) => input.length > 0 || 'Please enter a search term'
        }
    ]);

    const spinner = ora({
        text: display.spinnerMessage(`Searching for "${queryAnswer.query}"...`),
        spinner: 'dots12'
    }).start();

    try {
        const result = await api.search(queryAnswer.query, searchType, 15);

        if (!result.success) {
            spinner.fail(chalk.red('Search failed'));
            display.displayError(result.error);
            return;
        }

        spinner.succeed(chalk.green('Search complete!'));
        display.displaySearchResults(result.data, searchType);


        if (searchType === 'albums' && result.data.albums?.items?.length > 0) {
            const albums = result.data.albums.items;
            console.log(chalk.cyan('\n📥 Enter album number to download (0 to go back):'));

            const answer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'selection',
                    message: chalk.cyan('Album number:'),
                    validate: (input) => {
                        const num = parseInt(input);
                        if (num >= 0 && num <= albums.length) return true;
                        return `Please enter a number between 0 and ${albums.length}`;
                    }
                }
            ]);

            const selectedIdx = parseInt(answer.selection) - 1;
            if (selectedIdx >= 0 && albums[selectedIdx]) {
                await downloadAlbumInteractive(albums[selectedIdx].id);
            }
        } else if (searchType === 'tracks' && result.data.tracks?.items?.length > 0) {
            const tracks = result.data.tracks.items;
            console.log(chalk.cyan('\n📥 Enter track number to download (0 to go back):'));

            const answer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'selection',
                    message: chalk.cyan('Track number:'),
                    validate: (input) => {
                        const num = parseInt(input);
                        if (num >= 0 && num <= tracks.length) return true;
                        return `Please enter a number between 0 and ${tracks.length}`;
                    }
                }
            ]);

            const selectedIdx = parseInt(answer.selection) - 1;
            if (selectedIdx >= 0 && tracks[selectedIdx]) {
                await downloadTrackInteractive(tracks[selectedIdx].id);
            }
        } else if (searchType === 'artists' && result.data.artists?.items?.length > 0) {
            const artists = result.data.artists.items;
            console.log(chalk.cyan('\n🎤 Enter artist number to view albums (0 to go back):'));

            const answer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'selection',
                    message: chalk.cyan('Artist number:'),
                    validate: (input) => {
                        const num = parseInt(input);
                        if (num >= 0 && num <= artists.length) return true;
                        return `Please enter a number between 0 and ${artists.length}`;
                    }
                }
            ]);

            const selectedIdx = parseInt(answer.selection) - 1;
            if (selectedIdx >= 0 && artists[selectedIdx]) {
                await browseArtistAlbums(artists[selectedIdx].id);
            }
        }

    } catch (error) {
        spinner.fail(chalk.red('An error occurred'));
        display.displayError(error.message);
    }
}

async function browseArtistAlbums(artistId) {
    const spinner = ora({
        text: display.spinnerMessage('Fetching artist albums...'),
        spinner: 'dots12'
    }).start();

    try {
        const result = await api.getArtist(artistId);
        if (!result.success) {
            spinner.fail(chalk.red('Failed to get artist info'));
            return;
        }

        spinner.succeed(chalk.green(`Found ${result.data.albums_count || 0} albums by ${result.data.name}`));

        if (result.data.albums?.items?.length > 0) {
            const albums = result.data.albums.items;


            console.log(chalk.bold.cyan('\n💿 Albums:\n'));
            albums.forEach((album, i) => {
                const year = album.released_at ? new Date(album.released_at * 1000).getFullYear() : 'N/A';
                const quality = album.hires ? '✨' : '💿';
                console.log(chalk.white(`  ${(i + 1).toString().padStart(2, ' ')}) ${quality} ${album.title.substring(0, 45)} (${year})`));
            });
            console.log(chalk.gray('   0) ⬅️ Back to menu'));
            console.log();

            const answer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'selection',
                    message: chalk.cyan('Enter album number:'),
                    validate: (input) => {
                        const num = parseInt(input);
                        if (num >= 0 && num <= albums.length) return true;
                        return `Please enter a number between 0 and ${albums.length}`;
                    }
                }
            ]);

            const selectedIdx = parseInt(answer.selection) - 1;
            if (selectedIdx >= 0 && albums[selectedIdx]) {
                await downloadAlbumInteractive(albums[selectedIdx].id);
            }
        }
    } catch (error) {
        spinner.fail(chalk.red('An error occurred'));
    }
}

async function downloadAlbumInteractive(albumId) {

    const spinner = ora({
        text: display.spinnerMessage('Fetching album info...'),
        spinner: 'dots12'
    }).start();

    const albumInfo = await api.getAlbum(albumId);
    if (!albumInfo.success) {
        spinner.fail(chalk.red('Failed to fetch album info'));
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

    const confirmAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'proceed',
            message: chalk.cyan(`Download album? (y/n):`),
            default: 'y',
            validate: (input) => {
                if (['y', 'n', 'Y', 'N', 'yes', 'no'].includes(input.toLowerCase())) return true;
                return 'Please enter y or n';
            }
        }
    ]);

    if (confirmAnswer.proceed.toLowerCase() !== 'y' && confirmAnswer.proceed.toLowerCase() !== 'yes') {
        console.log(chalk.yellow('\n👋 Download cancelled.\n'));
        return;
    }

    console.log('\n' + chalk.cyan.bold('📥 Starting album download...\n'));

    const downloadResult = await downloadService.downloadAlbum(albumId, bestQuality, {
        onTrackStart: (track, num, total) => {
            console.log(chalk.cyan(`\n[${num}/${total}] `) + chalk.white.bold(track.title));
            console.log(chalk.gray(`    Artist: ${track.performer?.name || 'Unknown'}`));
        },
        onProgress: (progress) => {
            display.displayProgress(progress.phase, progress.percent, { speed: progress.speed });
        },
        onTrackComplete: (trackResult) => {
            if (trackResult.success) {
                console.log(chalk.green(`    ✅ Downloaded successfully`));
                if (trackResult.lyrics) {
                    console.log(chalk.magenta(`    🎤 Lyrics embedded (${trackResult.lyrics.syncedLyrics ? 'synced' : 'unsynced'})`));
                }
            } else {
                console.log(chalk.red(`    ❌ Failed: ${trackResult.error}`));
            }
        }
    });

    display.displayDownloadSummary(downloadResult);

    await inquirer.prompt([
        {
            type: 'input',
            name: 'continue',
            message: chalk.gray('Press Enter to continue...'),
        }
    ]);
}

async function downloadTrackInteractive(trackId) {

    const spinner = ora({
        text: display.spinnerMessage('Fetching track info...'),
        spinner: 'dots12'
    }).start();

    const trackInfo = await api.getTrack(trackId);
    if (!trackInfo.success) {
        spinner.fail(chalk.red('Failed to fetch track info'));
        return;
    }


    const track = trackInfo.data;
    const album = track.album || {};
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

    const confirmAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'proceed',
            message: chalk.cyan(`Download track? (y/n):`),
            default: 'y',
            validate: (input) => {
                if (['y', 'n', 'Y', 'N', 'yes', 'no'].includes(input.toLowerCase())) return true;
                return 'Please enter y or n';
            }
        }
    ]);

    if (confirmAnswer.proceed.toLowerCase() !== 'y' && confirmAnswer.proceed.toLowerCase() !== 'yes') {
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

    await inquirer.prompt([
        {
            type: 'input',
            name: 'continue',
            message: chalk.gray('Press Enter to continue...'),
        }
    ]);
}


async function handleDownload() {
    const urlAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'url',
            message: chalk.cyan('🔗 Enter Qobuz URL or Album/Track ID:'),
            validate: (input) => input.length > 0 || 'Please enter a valid URL'
        }
    ]);

    const parsed = api.parseUrl(urlAnswer.url);
    if (!parsed) {
        display.displayError('Invalid Qobuz URL. Please provide a valid album or track URL.');
        return;
    }

    if (parsed.type === 'album') {
        await downloadAlbumInteractive(parsed.id);
    } else if (parsed.type === 'track') {
        await downloadTrackInteractive(parsed.id);
    }
}

async function handleAccount() {
    const spinner = ora({
        text: display.spinnerMessage('Fetching account information...'),
        spinner: 'dots12'
    }).start();

    try {
        const result = await api.getUserInfo();

        if (!result.success) {
            spinner.fail(chalk.red('Failed to get account info'));
            display.displayError(result.error);
            return;
        }

        spinner.succeed(chalk.green('Account info retrieved!'));
        display.displayAccountInfo(result.data);

    } catch (error) {
        spinner.fail(chalk.red('An error occurred'));
        display.displayError(error.message);
    }

    await inquirer.prompt([
        {
            type: 'input',
            name: 'continue',
            message: chalk.gray('Press Enter to continue...'),
        }
    ]);
}

// ═══════════════════════════════════════════════════════════════════
// DEFAULT ACTION - INTERACTIVE MENU
// ═══════════════════════════════════════════════════════════════════

program
    .action(async () => {
        await showMainMenu();
    });

// ═══════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════

program.exitOverride();


const hasCommand = process.argv.length > 2;

try {
    if (hasCommand) {
        await program.parseAsync(process.argv);
    } else {

        await showMainMenu();
    }
} catch (error) {
    if (error.exitCode === 0 || error.code === 'commander.help' || error.code === 'commander.version') {
        process.exit(0);
    }
    display.displayError(error.message);
    process.exit(1);
}
