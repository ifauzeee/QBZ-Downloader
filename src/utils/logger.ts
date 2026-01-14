import chalk from 'chalk';

export type LogType = 'info' | 'success' | 'warn' | 'error' | 'debug' | 'msg';

class Logger {
    private static instance: Logger;

    private constructor() {}

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    log(message: string, type: LogType = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = chalk.gray(`[${timestamp}] `);

        switch (type) {
            case 'success':
                console.log(`${prefix}${chalk.green('✅ ' + message)}`);
                break;
            case 'warn':
                console.log(`${prefix}${chalk.yellow('⚠️ ' + message)}`);
                break;
            case 'error':
                console.log(`${prefix}${chalk.red('❌ ' + message)}`);
                break;
            case 'debug':
                console.log(`${prefix}${chalk.magenta('🔍 ' + message)}`);
                break;
            case 'msg':
                console.log(`${prefix}${chalk.white('📩 ' + message)}`);
                break;
            default:
                console.log(`${prefix}${chalk.blue('ℹ️ ' + message)}`);
        }
    }

    info(message: string) {
        this.log(message, 'info');
    }
    success(message: string) {
        this.log(message, 'success');
    }
    warn(message: string) {
        this.log(message, 'warn');
    }
    error(message: string) {
        this.log(message, 'error');
    }
    debug(message: string) {
        this.log(message, 'debug');
    }
    msg(message: string) {
        this.log(message, 'msg');
    }
}

export const logger = Logger.getInstance();
