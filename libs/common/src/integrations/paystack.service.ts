import { Injectable } from '@nestjs/common';
import { BaseIntegrationService } from '../services/base-integration.service';

@Injectable()
export class PaystackService extends BaseIntegrationService {
    protected readonly baseUrl = 'https://api.paystack.co';
    protected readonly apiKey = process.env.PAYSTACK_SECRET_KEY || '';

    /**
     * Fetches the list of all supported banks from Paystack.
     */
    async getBanks() {
        this.logger.log('🔄 Fetching Nigerian bank list from Paystack...');
        try {
            const response = await this.get<any>('/bank?country=nigeria');
            return response;
        } catch (error) {
            this.logger.error(`❌ Failed to fetch banks from Paystack: ${error.message}`);
            throw error;
        }
    }

    /**
     * Initializes a transaction with Paystack.
     * @param data { email, amount, reference, metadata }
     * Note: Amount should be in the base currency unit (e.g., Naira, not kobo). This method handles kobo conversion.
     */
    async initializeTransaction(data: { email: string; amount: number; reference: string; metadata?: any; callback_url?: string }) {
        this.logger.log(`🔄 Initializing Paystack transaction: ref=${data.reference}, amount=${data.amount} NGN`);
        try {
            const koboAmount = Math.round(data.amount * 100);
            const response = await this.post<any>('/transaction/initialize', {
                email: data.email,
                amount: koboAmount,
                reference: data.reference,
                metadata: data.metadata,
                callback_url: data.callback_url,
            });
            return response;
        } catch (error) {
            this.logger.error(`❌ Failed to initialize Paystack transaction: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verifies a transaction status with Paystack.
     */
    async verifyTransaction(reference: string) {
        this.logger.log(`🔍 Verifying Paystack transaction: ref=${reference}`);
        try {
            const response = await this.get<any>(`/transaction/verify/${reference}`);
            return response;
        } catch (error) {
            this.logger.error(`❌ Failed to verify Paystack transaction ${reference}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Initializes a Direct Debit authorization request.
     */
    async initializeDirectDebitAuthorization(data: { email: string; callback_url?: string; account?: any; address?: any; reference?: string }) {
        this.logger.log(`🔄 Initializing Paystack direct debit authorization for email=${data.email}`);
        try {
            const response = await this.post<any>('/customer/authorization/initialize', {
                email: data.email,
                channel: 'direct_debit',
                callback_url: data.callback_url || process.env.PAYSTACK_CALLBACK_URL,
                account: data.account,
                address: data.address,
                reference: data.reference,
            });
            return response;
        } catch (error) {
            this.logger.error(`❌ Failed to initialize Paystack direct debit: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verifies the status of a Direct Debit authorization.
     */
    async verifyAuthorization(reference: string) {
        this.logger.log(`🔍 Verifying Paystack authorization: ref=${reference}`);
        try {
            const response = await this.get<any>(`/customer/authorization/verify/${reference}`);
            return response;
        } catch (error) {
            this.logger.error(`❌ Failed to verify Paystack authorization ${reference}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Charges a customer's account using an existing authorization.
     * @param data { authorization_code, email, amount }
     * Note: Amount should be in the base currency unit (e.g., Naira, not kobo).
     */
    async chargeAuthorization(data: { authorization_code: string; email: string; amount: number; reference?: string; currency?: string }) {
        this.logger.log(`💸 Charging Paystack authorization ${data.authorization_code} for amount=${data.amount}`);
        try {
            const koboAmount = Math.round(data.amount * 100);
            const response = await this.post<any>('/transaction/charge_authorization', {
                authorization_code: data.authorization_code,
                email: data.email,
                amount: koboAmount,
                reference: data.reference,
                currency: data.currency || 'NGN',
            });
            return response;
        } catch (error) {
            this.logger.error(`❌ Failed to charge Paystack authorization: ${error.message}`);
            throw error;
        }
    }

    /**
     * Deactivates a Direct Debit authorization.
     */
    async deactivateAuthorization(authorization_code: string) {
        this.logger.log(`🛑 Deactivating Paystack authorization: code=${authorization_code}`);
        try {
            const response = await this.post<any>('/customer/authorization/deactivate', {
                authorization_code,
            });
            return response;
        } catch (error) {
            this.logger.error(`❌ Failed to deactivate Paystack authorization ${authorization_code}: ${error.message}`);
            throw error;
        }
    }
}
