import chalk from 'chalk';

export type LogType = 'info' | 'success' | 'warn' | 'error' | 'debug' | 'system';

class Logger {
    private static instance: Logger;
    private logs: any[] = [];
    private readonly MAX_LOGS = 500;

    private constructor() {}

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public getLogs() {
        return this.logs;
    }

    private broadcastCallback: ((log: any) => void) | null = null;

    public setBroadcastCallback(callback: (log: any) => void) {
        this.broadcastCallback = callback;
    }

    private getTimestamp(): string {
        return new Date().toLocaleTimeString('en-US', { hour12: false });
    }

    log(message: string, type: LogType = 'info', scope?: string) {
        const timestampStr = this.getTimestamp();
        this.logs.push({
            timestamp: timestampStr,
            type,
            scope: scope?.toUpperCase() || 'SYSTEM',
            message,
            time: Date.now()
        });

        if (this.logs.length > this.MAX_LOGS) {
            this.logs.shift();
        }

        if (this.broadcastCallback) {
            this.broadcastCallback(this.logs[this.logs.length - 1]);
        }

        const timestamp = chalk.gray(timestampStr);

        let icon = '';
        let badge = '';
        let colorizedMessage = message;

        switch (type) {
            case 'success':
                icon = '✅';
                badge = chalk.green.bold('SUCCESS'.padEnd(7));
                colorizedMessage = chalk.greenBright(message);
                break;
            case 'warn':
                icon = '⚠️ ';
                badge = chalk.yellow.bold('WARNING'.padEnd(7));
                colorizedMessage = chalk.yellowBright(message);
                break;
            case 'error':
                icon = '❌';
                badge = chalk.red.bold('ERROR  '.padEnd(7));
                colorizedMessage = chalk.redBright(message);
                break;
            case 'debug':
                icon = '🐛';
                badge = chalk.magenta.bold('DEBUG  '.padEnd(7));
                colorizedMessage = chalk.magenta(message);
                break;
            case 'system':
                icon = '💻';
                badge = chalk.cyan.bold('SYSTEM '.padEnd(7));
                colorizedMessage = chalk.cyanBright(message);
                break;
            default:
                icon = 'ℹ️ ';
                badge = chalk.blue.bold('INFO   '.padEnd(7));
                colorizedMessage = chalk.white(message);
        }

        const scopeStr = scope ? scope.toUpperCase() : '';
        const targetWidth = 8;
        const padding = Math.max(0, targetWidth - scopeStr.length);
        const padLeft = Math.floor(padding / 2);
        const padRight = padding - padLeft;
        const centeredScope = ' '.repeat(padLeft) + scopeStr + ' '.repeat(padRight);

        const scopeLabel = chalk.bold.white(`[${centeredScope}]`);
        const separator = chalk.gray('│');

        console.log(
            `${timestamp} ${separator} ${icon} ${badge} ${separator} ${scopeLabel} ${colorizedMessage}`
        );
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
