import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';
const execFileAsync = promisify(execFile);

export interface BinaryInfo {
    path: string;
    available: boolean;
    version?: string;
}

/**
 * Resolves the path to a binary (ffmpeg, fpcalc, etc)
 * prioritizing local versions in the application directory.
 */
export function resolveBinaryPath(binaryName: string): string {
    const ext = process.platform === 'win32' ? '.exe' : '';
    const nameWithExt = `${binaryName}${ext}`;

    // 1. Check environment variable override
    const envVar = `QBZ_${binaryName.toUpperCase()}_PATH`;
    if (process.env[envVar] && fs.existsSync(process.env[envVar]!)) {
        return process.env[envVar]!;
    }

    // 2. Check local 'bin' directory in the application root
    // In production (Electron), this is in resourcesPath
    const isDesktop = Boolean(process.versions.electron);
    const appRoot = isDev 
        ? path.join(__dirname, '..', '..') 
        : (isDesktop ? (process as unknown as { resourcesPath: string }).resourcesPath : process.cwd());
    const localBinCandidates = [
        path.join(appRoot, 'bin', `${process.platform}-${process.arch}`, nameWithExt),
        path.join(appRoot, 'bin', process.platform, nameWithExt),
        path.join(appRoot, 'bin', nameWithExt)
    ];

    for (const localBinPath of localBinCandidates) {
        if (fs.existsSync(localBinPath)) {
            return localBinPath;
        }
    }

    // 3. Check for the binary in the current directory (for portable versions)
    const portablePath = path.join(process.cwd(), nameWithExt);
    if (fs.existsSync(portablePath)) {
        return portablePath;
    }

    // 4. Fallback to system PATH
    return binaryName;
}

/**
 * Validates if a binary is available and functional.
 */
/**
 * Short-lived memo. Several HTTP routes call this per request; a spawn each
 * time is wasteful. The TTL keeps it from pinning a "not installed" answer for
 * the lifetime of the process when the user installs ffmpeg while it runs.
 */
const availabilityCache = new Map<string, { info: BinaryInfo; at: number }>();
const AVAILABILITY_TTL_MS = 60_000;

export async function checkBinaryAvailability(binaryName: string): Promise<BinaryInfo> {
    const cached = availabilityCache.get(binaryName);
    if (cached && Date.now() - cached.at < AVAILABILITY_TTL_MS) {
        return cached.info;
    }

    const binaryPath = resolveBinaryPath(binaryName);
    try {
        // argv form and a timeout: this runs on the HTTP request path, and a
        // synchronous shell spawn with no bound blocked the whole event loop
        // whenever the binary hung.
        const { stdout } = await execFileAsync(binaryPath, ['-version'], { timeout: 10000 });
        const firstLine = stdout.split('\n')[0];

        const info: BinaryInfo = {
            path: binaryPath,
            available: true,
            version: firstLine
        };
        availabilityCache.set(binaryName, { info, at: Date.now() });
        return info;
    } catch {
        const info: BinaryInfo = {
            path: binaryPath,
            available: false
        };
        availabilityCache.set(binaryName, { info, at: Date.now() });
        return info;
    }
}

/**
 * Logs a helpful message if a binary is missing.
 */
export function warnMissingBinary(binaryName: string, featureName: string) {
    logger.warn(`${binaryName} not found. ${featureName} will be disabled.`, 'BINARIES');
    logger.info(`To enable ${featureName}, please install ${binaryName} or place ${binaryName}${process.platform === 'win32' ? '.exe' : ''} in the application folder.`, 'BINARIES');
}
