import { logger } from './logger.js';

export async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryOperation<T>(
    operation: () => Promise<T>,
    retries = 3,
    delay = 1000,
    context = 'API'
): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (e: unknown) {
            lastError = e;
            const message = e instanceof Error ? e.message : String(e);
            const isAuthError = message.includes('401') || message.includes('403');
            const isNotFoundError =
                message.includes('404') || message.includes('not found');

            if (isAuthError || isNotFoundError) throw e;

            const waitTime = delay * Math.pow(2, i);
            logger.debug(
                `[${context}] Retry ${i + 1}/${retries} after ${waitTime}ms. Error: ${message}`,
                'RETRY'
            );
            await sleep(waitTime);
        }
    }
    throw lastError;
}
