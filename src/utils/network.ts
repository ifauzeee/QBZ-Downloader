import axios, { AxiosRequestConfig } from 'axios';

export function createAxiosInstance(config: AxiosRequestConfig = {}) {
    const axiosConfig: AxiosRequestConfig = {
        ...config,
        timeout: config.timeout ?? 60000
    };

    return axios.create(axiosConfig);
}

export async function downloadFile(url: string, axiosConfig: AxiosRequestConfig = {}) {
    const instance = createAxiosInstance(axiosConfig);
    return instance.get(url, { ...axiosConfig, responseType: 'stream' });
}
