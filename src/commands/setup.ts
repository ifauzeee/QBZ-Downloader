import fs from 'fs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import { displayBanner } from '../utils/display.js';
import { Command } from 'commander';
import { settingsService } from '../services/settings.js';

export function registerSetupCommand(program: Command) {
    program
        .command('setup')
        .description('Configure essential credentials and generate .env')
        .action(async () => {
            displayBanner();
            await runSetup();
        });
}

export async function runSetup() {
    console.log(
        boxen(
            chalk.cyan.bold('🛠️  QBZ-Downloader Setup Wizard\n\n') +
            chalk.white(
                'Wizard ini akan membantu Anda mengkonfigurasi aplikasi.\n' +
                'Anda memerlukan credentials Qobuz untuk melanjutkan.\n\n'
            ) +
            chalk.yellow('📖 Cara mendapatkan credentials:\n') +
            chalk.gray(
                '   1. Login ke play.qobuz.com di browser\n' +
                '   2. Buka Developer Tools (F12)\n' +
                '   3. Tab Network → Filter "api.json"\n' +
                '   4. Lihat request headers untuk token\n\n'
            ) +
            chalk.blue('🔗 Guide lengkap: ') +
            chalk.underline('https://github.com/ifauzeee/QBZ-Downloader#setup'),
            {
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: 'cyan'
            }
        )
    );

    try {
        console.log(chalk.bold.cyan('\n📋 Step 1/3: Qobuz Credentials (Required)\n'));

        const qobuzAnswers = await inquirer.prompt([
            {
                type: 'input',
                name: 'QOBUZ_APP_ID',
                message: chalk.white('App ID') + chalk.gray(' (biasanya angka 9-10 digit):'),
                default: settingsService.get('QOBUZ_APP_ID') || process.env.QOBUZ_APP_ID,
                validate: (input) => {
                    if (!input || input.length === 0) return '❌ App ID diperlukan';
                    if (!/^\d+$/.test(input)) return '⚠️ App ID biasanya berupa angka';
                    return true;
                }
            },
            {
                type: 'password',
                name: 'QOBUZ_APP_SECRET',
                message:
                    chalk.white('App Secret') + chalk.gray(' (string panjang, ~32 karakter):'),
                default: settingsService.get('QOBUZ_APP_SECRET') || process.env.QOBUZ_APP_SECRET,
                validate: (input) => {
                    if (!input || input.length === 0) return '❌ App Secret diperlukan';
                    if (input.length < 20)
                        return '⚠️ App Secret terlalu pendek. Pastikan copy lengkap.';
                    return true;
                }
            },
            {
                type: 'password',
                name: 'QOBUZ_USER_AUTH_TOKEN',
                message:
                    chalk.white('User Token') + chalk.gray(' (dari header x-user-auth-token):'),
                default:
                    settingsService.get('QOBUZ_USER_AUTH_TOKEN') ||
                    process.env.QOBUZ_USER_AUTH_TOKEN,
                validate: (input) => {
                    if (!input || input.length === 0) return '❌ User Token diperlukan';
                    return true;
                }
            },
            {
                type: 'input',
                name: 'QOBUZ_USER_ID',
                message: chalk.white('User ID') + chalk.gray(' (ID akun Qobuz Anda):'),
                default: settingsService.get('QOBUZ_USER_ID') || process.env.QOBUZ_USER_ID,
                validate: (input) => {
                    if (!input || input.length === 0) return '❌ User ID diperlukan';
                    return true;
                }
            }
        ]);

        console.log(chalk.bold.cyan('\n📱 Step 2/3: Telegram Bot (Optional)\n'));
        console.log(
            chalk.gray(
                '   Bot Telegram memungkinkan Anda mendownload dari mana saja.\n' +
                '   Lewati dengan menekan Enter jika tidak diperlukan.\n'
            )
        );

        const telegramAnswers = await inquirer.prompt([
            {
                type: 'input',
                name: 'TELEGRAM_BOT_TOKEN',
                message:
                    chalk.white('Bot Token') + chalk.gray(' (dari @BotFather, kosongkan jika tidak perlu):'),
                default: settingsService.get('TELEGRAM_BOT_TOKEN') || ''
            },
            {
                type: 'input',
                name: 'TELEGRAM_CHAT_ID',
                message: chalk.white('Chat ID') + chalk.gray(' (ID Anda untuk notifikasi):'),
                default: settingsService.get('TELEGRAM_CHAT_ID') || '',
                when: (ans) => !!ans.TELEGRAM_BOT_TOKEN
            }
        ]);

        console.log(chalk.bold.cyan('\n🖥️  Step 3/3: Web Dashboard\n'));

        const dashboardAnswers = await inquirer.prompt([
            {
                type: 'number',
                name: 'DASHBOARD_PORT',
                message: chalk.white('Port') + chalk.gray(' (default: 3000):'),
                default:
                    parseInt(settingsService.get('DASHBOARD_PORT') as string) ||
                    parseInt(process.env.DASHBOARD_PORT || '3000') ||
                    3000,
                validate: (input) => {
                    if (input < 1 || input > 65535) return '⚠️ Port harus antara 1-65535';
                    return true;
                }
            },
            {
                type: 'password',
                name: 'DASHBOARD_PASSWORD',
                message:
                    chalk.white('Password') + chalk.gray(' (proteksi dashboard, kosongkan jika tidak perlu):'),
                default: ''
            }
        ]);

        const answers = {
            ...qobuzAnswers,
            ...telegramAnswers,
            ...dashboardAnswers
        };

        const envContent = `# ==============================================================================
# QBZ-DOWNLOADER CONFIGURATION
# ==============================================================================
# Generated by setup wizard on ${new Date().toLocaleDateString('id-ID')}
# Untuk pengaturan lanjutan, gunakan Web Dashboard: qbz-dl dashboard
# ==============================================================================

# QOBUZ CREDENTIALS (REQUIRED)
QOBUZ_APP_ID=${answers.QOBUZ_APP_ID}
QOBUZ_APP_SECRET=${answers.QOBUZ_APP_SECRET}
QOBUZ_USER_AUTH_TOKEN=${answers.QOBUZ_USER_AUTH_TOKEN}
QOBUZ_USER_ID=${answers.QOBUZ_USER_ID}

# TELEGRAM BOT (OPTIONAL)
TELEGRAM_BOT_TOKEN=${answers.TELEGRAM_BOT_TOKEN || ''}
TELEGRAM_CHAT_ID=${answers.TELEGRAM_CHAT_ID || ''}

# WEB DASHBOARD
DASHBOARD_PORT=${answers.DASHBOARD_PORT}
DASHBOARD_PASSWORD=${answers.DASHBOARD_PASSWORD || ''}

# ENVIRONMENT
NODE_ENV=production
`;

        fs.writeFileSync('.env', envContent);

        settingsService.set('QOBUZ_APP_ID', answers.QOBUZ_APP_ID);
        settingsService.set('QOBUZ_APP_SECRET', answers.QOBUZ_APP_SECRET);
        settingsService.set('QOBUZ_USER_AUTH_TOKEN', answers.QOBUZ_USER_AUTH_TOKEN);
        settingsService.set('QOBUZ_USER_ID', answers.QOBUZ_USER_ID);
        settingsService.set('TELEGRAM_BOT_TOKEN', answers.TELEGRAM_BOT_TOKEN || '');
        settingsService.set('TELEGRAM_CHAT_ID', answers.TELEGRAM_CHAT_ID || '');
        settingsService.set('DASHBOARD_PORT', answers.DASHBOARD_PORT);
        settingsService.set('DASHBOARD_PASSWORD', answers.DASHBOARD_PASSWORD || '');

        console.log(
            boxen(
                chalk.bold.green('✅ Setup Berhasil!\n\n') +
                chalk.white('File ') +
                chalk.cyan('.env') +
                chalk.white(' telah dibuat.\n') +
                chalk.white('Credentials tersimpan di database.\n\n') +
                chalk.yellow('🚀 Langkah Selanjutnya:\n\n') +
                chalk.white('   1. ') +
                chalk.cyan('qbz-dl') +
                chalk.white('              → Menu interaktif\n') +
                chalk.white('   2. ') +
                chalk.cyan('qbz-dl dashboard') +
                chalk.white('    → Buka web dashboard\n') +
                chalk.white('   3. ') +
                chalk.cyan('qbz-dl download <url>') +
                chalk.white(' → Download langsung\n') +
                chalk.white('   4. ') +
                chalk.cyan('qbz-dl search <query>') +
                chalk.white(' → Cari & download\n'),
                {
                    padding: 1,
                    margin: 1,
                    borderStyle: 'round',
                    borderColor: 'green'
                }
            )
        );
    } catch (error: unknown) {
        if ((error as any).isTtyError) {
            console.error(
                chalk.red('❌ Setup gagal: Terminal tidak mendukung input interaktif.')
            );
            console.log(chalk.yellow('💡 Coba jalankan di terminal biasa (bukan IDE terminal).'));
        } else {
            console.error(chalk.red('❌ Setup gagal:'), (error as Error).message);
            console.log(chalk.yellow('💡 Jalankan ulang dengan: qbz-dl setup'));
        }
    }
}

