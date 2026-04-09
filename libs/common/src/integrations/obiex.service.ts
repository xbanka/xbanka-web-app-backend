import { Injectable } from '@nestjs/common';
import { BaseIntegrationService } from '../services/base-integration.service';
import * as crypto from 'crypto';
import { AxiosRequestConfig } from 'axios';

@Injectable()
export class ObiexService extends BaseIntegrationService {
    protected readonly baseUrl = process.env.OBIEX_BASE_URL || 'https://api.obiex.finance/v1';
    protected readonly apiKey = process.env.OBIEX_API_KEY || '';
    private readonly apiSecret = process.env.OBIEX_API_SECRET || process.env.OBIEX_SECRET || '';

    private generateSignature(method: string, fullPath: string, timestamp: number): string {
        const content = `${method.toUpperCase()}${fullPath}${timestamp}`;
        this.logger.debug(`✍️ Signing string: "${content}"`);
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(content)
            .digest('hex');
    }

    private getObiexHeaders(method: string, path: string, params?: any) {
        const timestamp = Date.now();
        let fullPath = `/v1${path}`;
        if (params && Object.keys(params).length > 0) {
            const query = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    query.append(key, String(value));
                }
            });
            const queryString = query.toString();
            if (queryString) {
                fullPath += `?${queryString}`;
            }
        }
        const signature = this.generateSignature(method, fullPath, timestamp);
        this.logger.debug(`🔑 Headers generated for ${method} ${fullPath}: API-KEY=${this.apiKey}, TIMESTAMP=${timestamp}`);
        return {
            'X-API-KEY': this.apiKey,
            'X-API-TIMESTAMP': timestamp.toString(),
            'X-API-SIGNATURE': signature,
            'Authorization': null, // Signal BaseIntegrationService to remove this header entirely
        };
    }

    async getGroupedPairs() {
        const path = '/trades/pairs/grouped';
        return this.get(path, {
            headers: this.getObiexHeaders('GET', path),
        });
    }

    async getPairs() {
        const path = '/trades/pairs';
        return this.get(path, {
            headers: this.getObiexHeaders('GET', path),
        });
    }

    async createQuote(sourceId: string, targetId: string, amount: number, side: string = 'sell') {
        const path = '/trades/quote';
        let payload;
        if (side === 'sell' || side === 'SELL') {
            payload = { sourceId, targetId, amount, side };
        } else {
            payload = { sourceId, targetId, amountToReceive: amount, side };
        }
        this.logger.debug(`📤 Obiex quote payload → ${JSON.stringify(payload)}`);
        return this.post(path, payload, {
            headers: this.getObiexHeaders('POST', path),
        });
    }

    async getExchangeRate(sourceId: string, targetId: string, amount: number, side: string = 'sell') {
        return this.createQuote(sourceId, targetId, amount, side);
    }

    async acceptQuote(quoteId: string) {
        const path = `/trades/quote/${quoteId}`;
        return this.post(path, {}, {
            headers: this.getObiexHeaders('POST', path),
        });
    }

    async getCurrencies() {
        const path = '/currencies';
        return this.get(path, {
            headers: this.getObiexHeaders('GET', path),
        });
    }

    async createBrokerAddress(purpose: string, currency: string, network: string) {
        const path = '/addresses/broker';
        return this.post(path, { purpose, currency, network }, {
            headers: this.getObiexHeaders('POST', path),
        });
    }

    async getMeBrokerAddresses() {
        const path = '/addresses/me/broker';
        return this.get(path, {
            headers: this.getObiexHeaders('GET', path),
        });
    }

    async swap(sourceId: string, targetId: string, amount: number, quoteId: string) {
        const path = '/swap';
        return this.post(path, { sourceId, targetId, amount, quoteId }, {
            headers: this.getObiexHeaders('POST', path),
        });
    }

    async withdraw(amount: number, currencyId: string, network: string, address: string) {
        // This was the initial withdraw method, keeping it but it might be redundant with withdrawCrypto
        const path = '/withdraw';
        return this.post(path, { amount, currencyId, network, address }, {
            headers: this.getObiexHeaders('POST', path),
        });
    }

    // Additional Endpoints from User Request

    async withdrawFiat(data: {
        destination: {
            accountNumber: string;
            accountName: string;
            bankName: string;
            bankCode: string;
            pagaBankCode?: string;
            merchantCode?: string;
        };
        amount: number;
        currency: string;
        narration: string;
    }) {
        // Documentation shows Bearer Token for this
        return this.post('/wallets/ext/debit/fiat', data);
    }

    async withdrawCrypto(data: {
        destination: {
            address: string;
            network: string;
            memo?: string;
        };
        amount: number;
        currency: string;
        narration: string;
    }) {
        const path = '/wallets/ext/debit/crypto';
        return this.post(path, data, {
            headers: this.getObiexHeaders('POST', path),
        });
    }

    async getCurrencyNetworks(currencyId: string) {
        // Documentation shows Bearer Token (using localhost:4000/v1/...)
        return this.get(`/currencies/${currencyId}/networks`);
    }

    async getNgnBanks() {
        // Documentation shows Bearer Token
        return this.get('/ngn-payments/banks');
    }

    async getUserTransactions(params?: { currencyId?: string; page?: number; pageSize?: number }) {
        const path = '/transactions/summary/me';
        return this.get(path, {
            headers: this.getObiexHeaders('GET', path, params),
            params,
        });
    }

    async getTransactionById(id: string) {
        const path = `/transactions/${id}`;
        return this.get(path, {
            headers: this.getObiexHeaders('GET', path),
        });
    }

    async getWalletBalance() {
        const path = '/wallets/me/balance';
        return this.get(path, {
            headers: this.getObiexHeaders('GET', path),
        });
    }

    async resendWebhooks(ids: string[]) {
        const path = '/transactions/resendWebhooks';
        return this.post(path, { ids }, {
            headers: this.getObiexHeaders('POST', path),
        });
    }

    async resendWebhook(id: string) {
        const path = `/transactions/${id}/resendWebhook`;
        return this.post(path, {}, {
            headers: this.getObiexHeaders('POST', path),
        });
    }

    async getPayoutTransactions(params?: { page?: number; pageSize?: number }) {
        const path = '/transactions/payouts';
        return this.get(path, {
            headers: this.getObiexHeaders('GET', path, params),
            params,
        });
    }

    async getDepositTransactions(params?: { page?: number; pageSize?: number }) {
        const path = '/transactions/deposits';
        return this.get(path, {
            headers: this.getObiexHeaders('GET', path, params),
            params,
        });
    }
}
