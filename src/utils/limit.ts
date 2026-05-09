import pLimit from 'p-limit';
import { CONFIG } from '../config.js';

/**
 * Global concurrency controller for all Qobuz API requests.
 * This ensures we don't exceed the rate limit even when
 * multiple services (Download, Migration, Search) are active.
 */
export const globalApiLimit = pLimit(CONFIG.download.concurrent || 4);

/**
 * Global concurrency controller for external metadata/lyrics lookups.
 * Usually more relaxed than the main API.
 */
export const globalMetadataLimit = pLimit(10);
