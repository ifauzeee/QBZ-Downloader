import React from 'react';
import { render } from 'ink';
import { EventEmitter } from 'events';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { Command } from 'commander';
import { CONFIG, getQualityName } from '../config.js';
import QobuzAPI from '../api/qobuz.js';
import DownloadService from '../services/download.js';
import LyricsProvider from '../api/lyrics.js';
import MetadataService from '../services/metadata.js';
import * as display from '../utils/display.js';
import * as prompts from './download/prompts.js';

import TrackSelector from '../ui/TrackSelector.js';
import DownloadManagerUI from '../ui/DownloadManagerUI.js';
import { Track } from '../types/qobuz.js';

const api = new QobuzAPI();
const lyricsProvider = new LyricsProvider();
const metadataService = new MetadataService();
const downloadService = new DownloadService(api, lyricsProvider, metadataService);

interface InteractiveOptions {
    batch?: boolean;
    skipExisting?: boolean;
}

const selectTracksTUI = async (tracks: Track[]): Promise<number[]> => {
    const { selected } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selected',
        message: 'Select tracks to download (Space to select, Enter to confirm):',
        choices: tracks.map((t, i) => ({
            name: t.title,
            value: i,
            checked: false
        })),
        pageSize: 15,
        loop: false
    }]);

    return selected.sort((a: number, b: number) => a - b);
};

const runDownloadTUI = async (downloadTask: (emitter: EventEmitter) => Promise<any>, title: string, totalTracks: number) => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(30);
    const { unmount } = render(<DownloadManagerUI emitter={emitter} title={title} totalTracks={totalTracks} />);
    try {
        const result = await downloadTask(emitter);
        await new Promise(r => setTimeout(r, 1000));
        unmount();
        return result;
    } catch (e) {
        unmount();
        throw e;
    }
};

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
        .option('-s, --skip-existing', 'Skip tracks that are already in history')
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
                    await downloadAlbumInteractive(parsed.id, options);
                } else if (parsed.type === 'track') {
                    spinner.stop();
                    await downloadTrackInteractive(parsed.id, options);
                } else if (parsed.type === 'playlist') {
                    spinner.stop();
                    await downloadPlaylistInteractive(parsed.id, options);
                } else if (parsed.type === 'artist') {
                    spinner.stop();
                    await downloadArtistInteractive(parsed.id, options);
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
    if (!album) {
        spinner.fail(chalk.red('Album data is missing'));
        return;
    }

    let bestQuality = 6;
    let qualityLabel = '💿 CD Quality (FLAC 16/44.1)';
    const sampleRate = album.maximum_sampling_rate || 44.1;
    const bitDepth = album.maximum_bit_depth || 16;
    if (bitDepth > 16 || album.hires || album.hires_streamable) {
        bestQuality = 27;
        if (sampleRate >= 176.4) qualityLabel = `🔥 Hi-Res Max (FLAC ${bitDepth}/${sampleRate})`;
        else qualityLabel = `✨ Hi-Res (FLAC ${bitDepth}/${sampleRate})`;
    }

    spinner.succeed(chalk.green('Album found!'));
    display.displayAlbumInfo(albumInfo.data!);

    let selectedQuality = bestQuality;
    let action = 'download';

    if (CONFIG.quality.default === 'ask' && !options.batch) {
        const qualityAnswer = await inquirer.prompt([{
            type: 'list',
            name: 'quality',
            message: chalk.cyan('🎚️ Select quality:'),
            choices: [
                { name: `🔥 Max Available (${qualityLabel})`, value: bestQuality },
                { name: '💿 CD Quality (16/44.1)', value: 6 },
                { name: '🎵 MP3 320kbps', value: 5 }
            ],
            default: bestQuality
        }]);
        selectedQuality = qualityAnswer.quality;
    } else {
        selectedQuality = typeof CONFIG.quality.default === 'number' ? CONFIG.quality.default : bestQuality;
    }

    if (!options.batch) {
        const confirmAnswer = await inquirer.prompt([prompts.getActionPrompt()]);
        action = confirmAnswer.action;
    }

    if (action === 'cancel') {
        console.log(chalk.yellow('\n👋 Download cancelled.\n'));
        return;
    }

    const tracks = album.tracks?.items || [];
    let trackIndices: number[] | undefined;

    if (action === 'select') {
        trackIndices = await selectTracksTUI(tracks);
        if (trackIndices.length === 0) {
            console.log(chalk.yellow('No tracks selected.'));
            return;
        }
    }



    console.log('');
    const downloadResult = await runDownloadTUI(async (emitter) => {
        return await downloadService.downloadAlbum(albumId, selectedQuality, {
            trackIndices,
            onProgress: (id, data) => emitter.emit('update', {
                id,
                state: {
                    ...data,
                    id,
                    downloadedBytes: data.loaded,
                    totalBytes: data.total
                }
            }),
            batch: options.batch,
            skipExisting: options.skipExisting
        });
    }, album.title, trackIndices ? trackIndices.length : tracks.length);

    if (downloadResult.success) {

        display.displaySuccess(`Album downloaded to: ${downloadResult.filePath || 'downloads'}`);
    } else {

        display.displayError(`Download completed with errors: ${downloadResult.failedTracks} failed.`);
    }

    display.displayDownloadSummary(downloadResult);
}

export async function downloadPlaylistInteractive(playlistId: string | number, options: InteractiveOptions = {}) {
    const spinner = ora('Fetching playlist info...').start();
    const playlistInfo = await api.getPlaylist(playlistId);

    if (!playlistInfo.success || !playlistInfo.data) {
        spinner.fail('Failed to fetch playlist');
        return;
    }
    spinner.succeed('Playlist found');
    const playlist = playlistInfo.data;

    const tracks = playlist.tracks.items || [];
    console.log(chalk.bold.hex('#FF00CC')(`\n🎶 ${playlist.name}`));
    console.log(chalk.gray(`${tracks.length} tracks`));

    let proceed = true;
    let selectedQuality = 27;

    if (!options.batch && CONFIG.quality.default === 'ask') {
        const q = await inquirer.prompt([{
            type: 'list',
            name: 'quality',
            message: 'Select Quality',
            choices: [{ name: 'Hi-Res', value: 27 }, { name: 'CD', value: 6 }, { name: 'MP3', value: 5 }]
        }]);
        selectedQuality = q.quality;

        const c = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: 'Download all tracks?',
            default: true
        }]);
        proceed = c.proceed;
    }

    if (!proceed) return;



    const result = await runDownloadTUI(async (emitter) => {
        return await downloadService.downloadPlaylist(playlistId, selectedQuality, {
            onProgress: (id, data) => emitter.emit('update', {
                id,
                state: {
                    ...data,
                    id,
                    downloadedBytes: data.loaded,
                    totalBytes: data.total
                }
            }),
            skipExisting: options.skipExisting
        });
    }, playlist.name, tracks.length);

    display.displayDownloadSummary(result);
}

export async function downloadArtistInteractive(artistId: string | number, options: InteractiveOptions = {}) {
    const spinner = ora('Fetching artist info...').start();
    const artistInfo = await api.getArtist(artistId);
    if (!artistInfo.success) { spinner.fail('Failed'); return; }
    spinner.succeed('Artist found');

    const artist = artistInfo.data as any;
    const albums = artist.albums?.items || [];

    console.log(chalk.bold.hex('#F37335')(`\n🎤 ${artist.name}`));
    console.log(`${albums.length} albums found.`);

    let proceed = true;
    if (!options.batch) {
        const c = await inquirer.prompt([{ type: 'confirm', name: 'proceed', message: 'Download discography?', default: true }]);
        proceed = c.proceed;
    }

    if (!proceed) return;


    console.log(chalk.cyan('Starting discography download...'));

    for (const album of albums) {
        console.log(chalk.bold.yellow(`\n💿 Album: ${album.title}`));
        const albumDetails = await api.getAlbum(album.id);
        const trackCount = albumDetails.success && albumDetails.data ? (albumDetails.data.tracks?.items?.length || 0) : 10;

        await runDownloadTUI(async (emitter) => {
            return await downloadService.downloadAlbum(album.id, 27, {
                onAlbumInfo: (album) => console.log(chalk.yellow(`\nProcessing: ${album.title}`)),
                onProgress: (id, data) => emitter.emit('update', {
                    id,
                    state: {
                        ...data,
                        id,
                        downloadedBytes: data.loaded,
                        totalBytes: data.total
                    }
                }),
                skipExisting: options.skipExisting
            });
        }, album.title, trackCount);
    }
}

export async function downloadTrackInteractive(trackId: string | number, options: InteractiveOptions = {}) {
    const spinner = ora('Fetching track..').start();
    const t = await api.getTrack(trackId);
    if (!t.success) { spinner.fail(); return; }
    spinner.succeed();
    const track = t.data!;

    let selectedQuality = 27;

    const result = await runDownloadTUI(async (emitter) => {
        return await downloadService.downloadTrack(trackId, selectedQuality, {
            onProgress: (p) => {
                emitter.emit('update', {
                    id: trackId.toString(),
                    state: {
                        id: trackId.toString(),
                        filename: track.title,
                        ...p,
                        downloadedBytes: p.loaded,
                        totalBytes: p.total,
                        status: p.phase === 'download' ? 'downloading' : 'processing'
                    }
                });
            },
            skipExisting: options.skipExisting
        });
    }, track.title, 1);

    display.displaySuccess(`Done: ${result.filePath}`);
}
