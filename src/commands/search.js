import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import QobuzAPI from '../api/qobuz.js';
import DownloadService from '../services/download.js';
import * as display from '../utils/display.js';
import { downloadAlbumInteractive, downloadTrackInteractive } from './download.js';

const api = new QobuzAPI();
const downloadService = new DownloadService();

export function registerSearchCommand(program) {
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
}

export async function handleSearch() {
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

export async function browseArtistAlbums(artistId) {
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
