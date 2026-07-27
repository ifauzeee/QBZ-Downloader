import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';

/**
 * Path containment for routes that act on a caller-supplied file path.
 *
 * The library routes take `filePath` straight from the request body and delete
 * or overwrite it. That is only safe while the dashboard is bound to loopback;
 * exposed on a network (a container, or DASHBOARD_HOST set to 0.0.0.0) it lets
 * any caller name any path the process can reach. These helpers keep such a
 * request inside the directories the app actually manages.
 */

/**
 * Resolve a path with symlinks followed, so a link inside the library cannot be
 * used to reach outside it. Falls back to the closest existing ancestor when the
 * target itself does not exist yet.
 */
const resolveReal = (target: string): string => {
    const resolved = path.resolve(target);
    try {
        return fs.realpathSync(resolved);
    } catch {
        try {
            return path.join(fs.realpathSync(path.dirname(resolved)), path.basename(resolved));
        } catch {
            return resolved;
        }
    }
};

/** Directories the app owns: the download/library root, plus the export dir. */
export const getManagedRoots = (): string[] =>
    [CONFIG.download.outputDir, CONFIG.export?.outputDir]
        .filter((root): root is string => typeof root === 'string' && root.trim().length > 0)
        .map(resolveReal);

/**
 * True when `filePath` resolves inside a directory the app manages. The
 * separator check stops a sibling such as `/music-backup` from matching the
 * root `/music`.
 */
export const isPathWithinManagedRoots = (filePath: unknown): boolean => {
    if (typeof filePath !== 'string' || !filePath.trim()) return false;

    const target = resolveReal(filePath);
    return getManagedRoots().some(
        (root) => target === root || target.startsWith(root + path.sep)
    );
};
