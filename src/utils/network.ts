import axios, { AxiosRequestConfig } from 'axios';
import { CONFIG } from '../config.js';
import { logger } from './logger.js';

export function createAxiosInstance(config: AxiosRequestConfig = {}) {
    const proxyUrl = CONFIG.api.proxy;
    const axiosConfig: AxiosRequestConfig = {
        ...config,
        timeout: config.timeout ?? 60000
    };

    if (proxyUrl) {
        try {
            const url = new URL(proxyUrl);
            axiosConfig.proxy = {
                protocol: url.protocol.replace(':', ''),
                host: url.hostname,
                port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80)
            };

            if (url.username || url.password) {
                axiosConfig.proxy.auth = {
                    username: decodeURIComponent(url.username),
                    password: decodeURIComponent(url.password)
                };
            }
            logger.debug(`Using proxy: ${url.hostname}:${axiosConfig.proxy.port}`);
        } catch {
            logger.error(`Invalid proxy URL: ${proxyUrl}`);
        }
    }

    return axios.create(axiosConfig);
}

export async function downloadFile(url: string, axiosConfig: AxiosRequestConfig = {}) {
    const instance = createAxiosInstance(axiosConfig);
    return instance.get(url, { ...axiosConfig, responseType: 'stream' });
}
