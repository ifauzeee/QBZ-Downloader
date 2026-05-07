import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

export type LogType = 'info' | 'success' | 'warn' | 'error' | 'debug' | 'system';

class Logger {
    private static instance: Logger;
    private logs: any[] = [];
    private readonly MAX_LOGS = 500;
    private readonly LOG_DIR = path.resolve('./logs');
    private readonly CURRENT_LOG_FILE = 'qbz-latest.log';
    private readonly MAX_LOG_FILES = 5;

    private constructor() {
        this.initLogDir();
    }

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
        const logEntry = {
            timestamp: timestampStr,
            type,
            scope: scope?.toUpperCase() || 'SYSTEM',
            message,
            time: Date.now()
        };

        this.logs.push(logEntry);
        this.writeToLogFile(logEntry);

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

    private initLogDir() {
        if (!fs.existsSync(this.LOG_DIR)) {
            fs.mkdirSync(this.LOG_DIR, { recursive: true });
        }
    }

    private writeToLogFile(logEntry: any) {
        try {
            const logFilePath = path.join(this.LOG_DIR, this.CURRENT_LOG_FILE);
            const line = `[${logEntry.timestamp}] [${logEntry.type.toUpperCase().padEnd(7)}] [${logEntry.scope}] ${logEntry.message}\n`;

            if (fs.existsSync(logFilePath) && fs.statSync(logFilePath).size > 5 * 1024 * 1024) {
                this.rotateLogs();
            }

            fs.appendFileSync(logFilePath, line, 'utf8');
        } catch (e) {
        }
    }

    private rotateLogs() {
        try {
            const logFilePath = path.join(this.LOG_DIR, this.CURRENT_LOG_FILE);

            for (let i = this.MAX_LOG_FILES - 1; i >= 1; i--) {
                const oldPath = path.join(this.LOG_DIR, `qbz-old-${i}.log`);
                const nextPath = path.join(this.LOG_DIR, `qbz-old-${i + 1}.log`);
                if (fs.existsSync(oldPath)) {
                    if (i === this.MAX_LOG_FILES - 1) {
                        fs.unlinkSync(oldPath);
                    } else {
                        fs.renameSync(oldPath, nextPath);
                    }
                }
            }

            if (fs.existsSync(logFilePath)) {
                fs.renameSync(logFilePath, path.join(this.LOG_DIR, 'qbz-old-1.log'));
            }
        } catch (e) {
        }
    }
}

export const logger = Logger.getInstance();
