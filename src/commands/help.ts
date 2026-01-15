import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { APP_VERSION, APP_NAME } from '../constants.js';

export function registerHelpCommand(program: Command) {
    program
        .command('help')
        .alias('h')
        .description('Show detailed help and usage examples')
        .action(() => {
            showDetailedHelp();
        });

    program
        .command('examples')
        .description('Show usage examples')
        .action(() => {
            showExamples();
        });
}

function showDetailedHelp() {
    console.log(
        boxen(
            chalk.bold.cyan(`${APP_NAME} v${APP_VERSION}\n\n`) +
            chalk.white('Premium Qobuz Downloader dengan Hi-Res Audio,\n') +
            chalk.white('Complete Metadata & Embedded Lyrics.\n'),
            {
                padding: 1,
                margin: { top: 1, bottom: 0, left: 1, right: 1 },
                borderStyle: 'round',
                borderColor: 'cyan'
            }
        )
    );

    console.log(chalk.bold.yellow('\n📋 PERINTAH UTAMA:\n'));

    const commands = [
        {
            cmd: 'qbz-dl',
            desc: 'Buka menu interaktif utama',
            example: ''
        },
        {
            cmd: 'qbz-dl download <url>',
            desc: 'Download dari URL Qobuz',
            example: 'qbz-dl download https://play.qobuz.com/album/123'
        },
        {
            cmd: 'qbz-dl search <query>',
            desc: 'Cari dan download musik',
            example: 'qbz-dl search "Daft Punk"'
        },
        {
            cmd: 'qbz-dl dashboard',
            desc: 'Buka web dashboard',
            example: ''
        },
        {
            cmd: 'qbz-dl bot',
            desc: 'Jalankan Telegram bot',
            example: ''
        },
        {
            cmd: 'qbz-dl setup',
            desc: 'Konfigurasi ulang credentials',
            example: ''
        }
    ];

    commands.forEach(({ cmd, desc, example }) => {
        console.log(`  ${chalk.cyan(cmd.padEnd(30))} ${chalk.white(desc)}`);
        if (example) {
            console.log(`  ${chalk.gray('Contoh: ' + example)}`);
        }
    });

    console.log(chalk.bold.yellow('\n⚙️ OPSI DOWNLOAD:\n'));

    const options = [
        { opt: '-q, --quality <id>', desc: 'Kualitas audio (5=MP3, 6=CD, 7=Hi-Res, 27=Max)' },
        { opt: '-o, --output <path>', desc: 'Folder output (default: ./downloads)' },
        { opt: '--no-lyrics', desc: 'Lewati embedding lyrics' },
        { opt: '--no-cover', desc: 'Lewati embedding cover art' },
        { opt: '-s, --skip-existing', desc: 'Lewati track yang sudah ada' },
        { opt: '-i, --interactive', desc: 'Mode interaktif untuk pemilihan track' }
    ];

    options.forEach(({ opt, desc }) => {
        console.log(`  ${chalk.green(opt.padEnd(25))} ${chalk.white(desc)}`);
    });

    console.log(chalk.bold.yellow('\n🎵 KUALITAS AUDIO:\n'));

    const qualities = [
        { id: '27', name: 'Hi-Res Max', detail: 'FLAC 24-bit/192kHz', emoji: '🔥' },
        { id: '7', name: 'Hi-Res', detail: 'FLAC 24-bit/96kHz', emoji: '✨' },
        { id: '6', name: 'CD Quality', detail: 'FLAC 16-bit/44.1kHz', emoji: '💿' },
        { id: '5', name: 'MP3', detail: '320 kbps', emoji: '🎵' }
    ];

    qualities.forEach(({ id, name, detail, emoji }) => {
        console.log(`  ${emoji} ${chalk.bold(id)} = ${chalk.cyan(name)} ${chalk.gray(`(${detail})`)}`);
    });

    console.log(chalk.bold.yellow('\n📖 LEBIH LANJUT:\n'));
    console.log(`  ${chalk.white('Jalankan')} ${chalk.cyan('qbz-dl examples')} ${chalk.white('untuk melihat contoh penggunaan.')}`);
    console.log(`  ${chalk.white('Dokumentasi:')} ${chalk.underline.blue('https://github.com/ifauzeee/QBZ-Downloader')}`);
    console.log();
}

function showExamples() {
    console.log(chalk.bold.cyan('\n📚 CONTOH PENGGUNAAN QBZ-DOWNLOADER\n'));

    const examples = [
        {
            title: '🎹 Download Album dengan Kualitas Maksimal',
            code: 'qbz-dl download https://play.qobuz.com/album/abc123 -q 27'
        },
        {
            title: '🎤 Download Track Tunggal',
            code: 'qbz-dl download https://play.qobuz.com/track/12345'
        },
        {
            title: '📋 Download Playlist',
            code: 'qbz-dl download https://play.qobuz.com/playlist/67890'
        },
        {
            title: '🔍 Cari dan Download',
            code: 'qbz-dl search "Bohemian Rhapsody"'
        },
        {
            title: '📥 Download ke Folder Khusus',
            code: 'qbz-dl download <url> -o "D:/Music/HiRes"'
        },
        {
            title: '⚡ Download Cepat (skip existing)',
            code: 'qbz-dl download <url> -s'
        },
        {
            title: '🎧 Download CD Quality (hemat ruang)',
            code: 'qbz-dl download <url> -q 6'
        },
        {
            title: '📝 Download Tanpa Lyrics',
            code: 'qbz-dl download <url> --no-lyrics'
        }
    ];

    examples.forEach(({ title, code }) => {
        console.log(`  ${chalk.yellow(title)}`);
        console.log(`  ${chalk.gray('$')} ${chalk.cyan(code)}\n`);
    });

    console.log(chalk.bold.cyan('💡 TIPS:\n'));
    console.log(`  ${chalk.white('• Gunakan')} ${chalk.cyan('qbz-dl dashboard')} ${chalk.white('untuk antarmuka visual yang lebih mudah.')}`);
    console.log(`  ${chalk.white('• Clipboard auto-detect: copy URL Qobuz lalu jalankan')} ${chalk.cyan('qbz-dl')}`);
    console.log(`  ${chalk.white('• Telegram Bot memungkinkan download dari mana saja.')}`);
    console.log();
}

export default { registerHelpCommand };
