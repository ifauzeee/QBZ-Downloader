import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';

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
        : (isDesktop ? (process as any).resourcesPath : process.cwd());
    const localBinPath = path.join(appRoot, 'bin', nameWithExt);

    if (fs.existsSync(localBinPath)) {
        return localBinPath;
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
export async function checkBinaryAvailability(binaryName: string): Promise<BinaryInfo> {
    const binaryPath = resolveBinaryPath(binaryName);
    try {
        const cmd = `"${binaryPath}" -version`;
        const output = execSync(cmd, { stdio: 'pipe' }).toString();
        const firstLine = output.split('\n')[0];
        
        return {
            path: binaryPath,
            available: true,
            version: firstLine
        };
    } catch (err) {
        return {
            path: binaryPath,
            available: false
        };
    }
}

/**
 * Logs a helpful message if a binary is missing.
 */
export function warnMissingBinary(binaryName: string, featureName: string) {
    logger.warn(`${binaryName} not found. ${featureName} will be disabled.`, 'BINARIES');
    logger.info(`To enable ${featureName}, please install ${binaryName} or place ${binaryName}${process.platform === 'win32' ? '.exe' : ''} in the application folder.`, 'BINARIES');
}
