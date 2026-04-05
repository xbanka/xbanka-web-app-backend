import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
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
                const responseData = error.response?.data;
                const logMessage = responseData 
                    ? `Error in integration: ${error.message} | Response: ${JSON.stringify(responseData)}`
                    : `Error in integration: ${error.message}`;
                
                this.logger.error(logMessage);
                if (!responseData) {
                    this.logger.debug(error.stack);
                }
                
                const status = error.response?.status || error.status || 500;
                throw new RpcException({
                    message: responseData?.message || error.message,
                    status: status,
                    details: responseData || error.message
                });
            },
        );
    }

    protected async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        const headers = {
            ...(config?.headers?.Authorization === null ? {} : { Authorization: `Bearer ${this.apiKey}` }),
            ...config?.headers,
        };
        // Clean up internal suppression flag
        if (headers.Authorization === null) delete headers.Authorization;

        const response: AxiosResponse<T> = await this.axios.get(`${this.baseUrl}${url}`, {
            ...config,
            headers,
        });
        return response.data;
    }

    protected async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        const headers = {
            ...(config?.headers?.Authorization === null ? {} : { Authorization: `Bearer ${this.apiKey}` }),
            ...config?.headers,
        };
        // Clean up internal suppression flag
        if (headers.Authorization === null) delete headers.Authorization;

        const response: AxiosResponse<T> = await this.axios.post(`${this.baseUrl}${url}`, data, {
            ...config,
            headers,
        });
        return response.data;
    }
}
