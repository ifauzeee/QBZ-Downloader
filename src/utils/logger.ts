import chalk from 'chalk';

export type LogType = 'info' | 'success' | 'warn' | 'error' | 'debug' | 'system';

class Logger {
    private static instance: Logger;

    private constructor() {}

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private getTimestamp(): string {
        return new Date().toLocaleTimeString('en-US', { hour12: false });
    }

    private formatScope(scope?: string): string {
        return scope ? chalk.gray(`[${scope.toUpperCase()}]`) : '';
    }

    log(message: string, type: LogType = 'info', scope?: string) {
        const timestamp = chalk.dim(this.getTimestamp());
        const scopeStr = this.formatScope(scope);
        const separator = chalk.dim('│');

        let levelBadge = '';
        let msgColor = (msg: string) => msg;

        switch (type) {
            case 'success':
                levelBadge = chalk.bold.green(' SUCCESS ');
                msgColor = chalk.green;
                break;
            case 'warn':
                levelBadge = chalk.bold.yellow(' WARNING ');
                msgColor = chalk.yellow;
                break;
            case 'error':
                levelBadge = chalk.bold.red('  ERROR  ');
                msgColor = chalk.red;
                break;
            case 'debug':
                levelBadge = chalk.bold.magenta('  DEBUG  ');
                msgColor = chalk.magenta;
                break;
            case 'system':
                levelBadge = chalk.bold.cyan('  SYSTEM ');
                msgColor = chalk.cyan;
                break;
            default:
                levelBadge = chalk.bold.blue('  INFO   ');
                msgColor = chalk.white;
        }

        const content = scope ? `${scopeStr.padEnd(10)} ${message}` : message;

        console.log(`${timestamp} ${separator} ${levelBadge} ${separator} ${msgColor(content)}`);
    }

    info(message: string, scope?: string) {
        this.log(message, 'info', scope);
    }
    success(message: string, scope?: string) {
        this.log(message, 'success', scope);
    }
    warn(message: string, scope?: string) {
        this.log(message, 'warn', scope);
    }
    error(message: string, scope?: string) {
        this.log(message, 'error', scope);
    }
    debug(message: string, scope?: string) {
        this.log(message, 'debug', scope);
    }
    system(message: string, scope?: string) {
        this.log(message, 'system', scope);
    }
}

export const logger = Logger.getInstance();
