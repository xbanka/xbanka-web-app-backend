import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

@Injectable()
export abstract class BaseIntegrationService {
    protected readonly axios: AxiosInstance;
    protected abstract readonly baseUrl: string;
    protected abstract readonly apiKey: string;
    protected readonly logger = new Logger(this.constructor.name);

    constructor() {
        this.axios = axios.create({
            timeout: 10000,
        });

        this.axios.interceptors.request.use((config) => {
            this.logger.debug(`Request to ${config.url}`);
            return config;
        });

        this.axios.interceptors.response.use(
            (response) => response,
            (error) => {
                this.logger.error(`Error in integration: ${error.message}`, error.stack);
                throw error;
            },
        );
    }

    protected async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await this.axios.get(`${this.baseUrl}${url}`, {
            ...config,
            headers: { ...config?.headers, Authorization: `Bearer ${this.apiKey}` },
        });
        return response.data;
    }

    protected async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await this.axios.post(`${this.baseUrl}${url}`, data, {
            ...config,
            headers: { ...config?.headers, Authorization: `Bearer ${this.apiKey}` },
        });
        return response.data;
    }
}
