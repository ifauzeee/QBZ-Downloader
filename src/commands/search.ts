import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import QobuzAPI from '../api/qobuz.js';
import DownloadService from '../services/download.js';
import * as display from '../utils/display.js';
import { parseSelection, validateSelection } from '../utils/input.js';
import { downloadAlbumInteractive, downloadTrackInteractive } from './download.js';
import { Command } from 'commander';

const api = new QobuzAPI();
const downloadService = new DownloadService();

export function registerSearchCommand(program: Command) {
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
                    display.displayError(result.error || 'Unknown error');
                    process.exit(1);
                }

                spinner.succeed(chalk.green('Search complete!'));
                display.displaySearchResults(result.data, options.type);

                if (options.type === 'albums' && result.data.albums?.items?.length > 0) {
                    const choices = result.data.albums.items.map((album: any, i: number) => ({
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

                        const downloadResult = await downloadService.downloadAlbum(
                            answer.albumId,
                            downloadAnswer.quality,
                            {
                                onTrackStart: (track, num, total) => {
                                    console.log(
                                        chalk.cyan(`\n[${num}/${total}] `) +
                                        chalk.white.bold(track.title)
                                    );
                                },
                                onProgress: (phase: any, loaded: any, total: any) => {
                                    display.displayProgress(phase, loaded, total);
                                },
                                onTrackComplete: (trackResult: any) => {
                                    if (trackResult.success) {
                                        console.log(chalk.green('    ✅ Complete'));
                                    } else {
                                        console.log(chalk.red('    ❌ Failed'));
                                    }
                                }
                            }
                        );

                        display.displayDownloadSummary(downloadResult);
                    }
                }
            } catch (error: any) {
                spinner.fail(chalk.red('An error occurred'));
                display.displayError(error.message);
                process.exit(1);
            }
        });
}

export async function handleSearch() {
    let inSearchMenu = true;

    while (inSearchMenu) {
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

        const typeMap: Record<string, string> = {
            '0': 'back',
            '1': 'albums',
            '2': 'tracks',
            '3': 'artists'
        };
        const searchType = typeMap[searchOptions.type];

        if (searchType === 'back') {
            inSearchMenu = false;
            break;
        }

        const searchLabel =
            searchType === 'albums' ? 'album' : searchType === 'tracks' ? 'track' : 'artist';

        const queryAnswer = await inquirer.prompt([
            {
                type: 'input',
                name: 'query',
                message: chalk.cyan(`🔎 Enter ${searchLabel} name (or 0 to cancel):`),
                validate: (input) => input.length > 0 || 'Please enter a search term'
            }
        ]);

        if (queryAnswer.query === '0') continue;

        const spinner = ora({
            text: display.spinnerMessage(`Searching for "${queryAnswer.query}"...`),
            spinner: 'dots12'
        }).start();

        try {
            const result = await api.search(queryAnswer.query, searchType, 50);

            if (!result.success) {
                spinner.fail(chalk.red('Search failed'));
                display.displayError(result.error || 'Unknown error');
                continue;
            }

            if (searchType === 'tracks' && result.data.tracks?.items) {
                result.data.tracks.items.sort((a: any, b: any) => {
                    const albumA = a.album?.title || '';
                    const albumB = b.album?.title || '';
                    return albumA.localeCompare(albumB);
                });
            }

            spinner.succeed(chalk.green('Search complete!'));
            display.displaySearchResults(result.data, searchType);

            if (result.data.albums?.items?.length > 0) {
                const albums = result.data.albums.items;
                console.log(
                    chalk.cyan(
                        '\n📥 Enter album number(s) to download (e.g. 1-3, 5) or 0 to go back:'
                    )
                );

                const answer = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'selection',
                        message: chalk.cyan('Selection:'),
                        validate: (input) => validateSelection(input, albums.length)
                    }
                ]);

                if (answer.selection === '0') continue;

                const selectedIndices = parseSelection(answer.selection, albums.length);
                const batchMode = selectedIndices.length > 1;

                for (const idx of selectedIndices) {
                    if (albums[idx]) {
                        console.log(
                            chalk.yellow(
                                `\nProcessing album ${idx + 1}/${albums.length}: ${albums[idx].title}`
                            )
                        );
                        await downloadAlbumInteractive(albums[idx].id, { batch: batchMode });
                    }
                }
            } else if (result.data.tracks?.items?.length > 0) {
                const tracks = result.data.tracks.items;
                console.log(
                    chalk.cyan(
                        '\n📥 Enter track number(s) to download (e.g. 1-3, 5) or 0 to go back:'
                    )
                );

                const answer = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'selection',
                        message: chalk.cyan('Selection:'),
                        validate: (input) => validateSelection(input, tracks.length)
                    }
                ]);

                if (answer.selection === '0') continue;

                const selectedIndices = parseSelection(answer.selection, tracks.length);
                const batchMode = selectedIndices.length > 1;

                for (const idx of selectedIndices) {
                    if (tracks[idx]) {
                        console.log(
                            chalk.yellow(
                                `\nProcessing track ${idx + 1}/${tracks.length}: ${tracks[idx].title}`
                            )
                        );
                        await downloadTrackInteractive(tracks[idx].id, { batch: batchMode });
                    }
                }
            } else if (result.data.artists?.items?.length > 0) {
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
                    const artist = artists[selectedIdx];

                    const viewAnswer = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'view',
                            message: chalk.cyan(`View ${artist.name}'s:`),
                            choices: [
                                { name: '💿 Albums', value: 'albums' },
                                { name: '🎵 Top Tracks', value: 'tracks' }
                            ]
                        }
                    ]);

                    if (viewAnswer.view === 'albums') {
                        await browseArtistAlbums(artist.id);
                    } else {
                        await browseArtistTracks(artist.name);
                    }
                }
            }
        } catch (error: any) {
            spinner.fail(chalk.red('An error occurred'));
            display.displayError(error.message);
        }
    }
}

export async function browseArtistAlbums(artistId: string | number) {
    let offset = 0;
    const limit = 20;
    let keepBrowsing = true;

    while (keepBrowsing) {
        console.clear();
        display.displayBanner();

        const spinner = ora({
            text: display.spinnerMessage('Fetching artist albums...'),
            spinner: 'dots12'
        }).start();

        try {
            const result = await api.getArtist(artistId, offset, limit);
            if (!result.success) {
                spinner.fail(chalk.red('Failed to get artist info'));
                return;
            }

            const totalAlbums = result.data.albums.total;
            const albums = result.data.albums.items;
            const artistName = result.data.name;

            spinner.stop();

            console.log(
                chalk.bold.cyan(
                    `\n💿 Albums by ${artistName} (${offset + 1}-${Math.min(offset + albums.length, totalAlbums)} of ${totalAlbums}):\n`
                )
            );

            if (albums.length === 0) {
                console.log(chalk.yellow('   No albums found in this range.'));
            } else {
                albums.forEach((album: any, i: number) => {
                    const year = album.released_at
                        ? new Date(album.released_at * 1000).getFullYear()
                        : 'N/A';
                    const quality = album.hires ? '✨' : '💿';
                    console.log(
                        chalk.white(
                            `  ${(i + 1).toString().padStart(2, ' ')} ) ${quality} ${album.title.substring(0, 45)} (${year})`
                        )
                    );
                });
            }
            console.log();

            const choices = [];
            if (offset + albums.length < totalAlbums) {
                console.log(chalk.cyan('  n) ➡️  Next Page'));
                choices.push('n');
            }
            if (offset > 0) {
                console.log(chalk.cyan('  p) ⬅️  Previous Page'));
                choices.push('p');
            }
            console.log(chalk.gray('  0) ⬅️  Back to menu'));
            console.log();

            const answer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'selection',
                    message: chalk.cyan('Enter choice:'),
                    validate: (input) => {
                        if (input === '0' || input === 'n' || input === 'p') return true;
                        const num = parseInt(input);
                        if (num >= 1 && num <= albums.length) return true;
                        return `Please enter 'n', 'p', '0', or a number between 1 and ${albums.length}`;
                    }
                }
            ]);

            const selection = answer.selection.toLowerCase();

            if (selection === '0') {
                keepBrowsing = false;
            } else if (selection === 'n') {
                if (offset + limit < totalAlbums) {
                    offset += limit;
                } else {
                    console.log(chalk.yellow('\n⚠️ No more pages.'));
                    await new Promise((r) => setTimeout(r, 1000));
                }
            } else if (selection === 'p') {
                if (offset >= limit) {
                    offset -= limit;
                } else {
                    console.log(chalk.yellow('\n⚠️ This is the first page.'));
                    await new Promise((r) => setTimeout(r, 1000));
                }
            } else {
                const selectedIdx = parseInt(selection) - 1;
                if (selectedIdx >= 0 && albums[selectedIdx]) {
                    await downloadAlbumInteractive(albums[selectedIdx].id);
                }
            }
        } catch (error) {
            spinner.fail(chalk.red('An error occurred'));
            console.error(error);
            keepBrowsing = false;
        }
    }
}

export async function browseArtistTracks(artistName: string) {
    const spinner = ora({
        text: display.spinnerMessage(`Fetching tracks for ${artistName}...`),
        spinner: 'dots12'
    }).start();

    try {
        const result = await api.search(artistName, 'tracks', 50);

        if (!result.success) {
            spinner.fail(chalk.red('Failed to fetch tracks'));
            display.displayError(result.error || 'Unknown error');
            return;
        }

        if (result.data.tracks?.items) {
            result.data.tracks.items.sort((a: any, b: any) => {
                const albumA = a.album?.title || '';
                const albumB = b.album?.title || '';
                return albumA.localeCompare(albumB);
            });
        }

        spinner.succeed(chalk.green(`Found tracks for ${artistName}`));
        display.displaySearchResults(result.data, 'tracks');

        if (result.data.tracks?.items?.length > 0) {
            const tracks = result.data.tracks.items;
            console.log(
                chalk.cyan('\n📥 Enter track number(s) to download (e.g. 1-3, 5) or 0 to go back:')
            );

            const answer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'selection',
                    message: chalk.cyan('Selection:'),
                    validate: (input) => validateSelection(input, tracks.length)
                }
            ]);

            if (answer.selection === '0') return;

            const selectedIndices = parseSelection(answer.selection, tracks.length);
            const batchMode = selectedIndices.length > 1;

            for (const idx of selectedIndices) {
                if (tracks[idx]) {
                    console.log(
                        chalk.yellow(
                            `\nProcessing track ${idx + 1}/${tracks.length}: ${tracks[idx].title}`
                        )
                    );
                    await downloadTrackInteractive(tracks[idx].id, { batch: batchMode });
                }
            }
        }
    } catch (error) {
        spinner.fail(chalk.red('An error occurred'));
        console.error(error);
    }
}
