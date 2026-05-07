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
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (e: any) {
            lastError = e;
            const isAuthError = e.message?.includes('401') || e.message?.includes('403');
            const isNotFoundError =
                e.message?.includes('404') || e.message?.includes('not found');

            if (isAuthError || isNotFoundError) throw e;

            const waitTime = delay * Math.pow(2, i);
            logger.debug(
                `[${context}] Retry ${i + 1}/${retries} after ${waitTime}ms. Error: ${e.message}`,
                'RETRY'
            );
            await sleep(waitTime);
        }
    }
    throw lastError;
}
