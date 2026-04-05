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
    async initializeTransaction(data: { email: string; amount: number; reference: string; metadata?: any }) {
        this.logger.log(`🔄 Initializing Paystack transaction: ref=${data.reference}, amount=${data.amount} NGN`);
        try {
            const koboAmount = Math.round(data.amount * 100);
            const response = await this.post<any>('/transaction/initialize', {
                email: data.email,
                amount: koboAmount,
                reference: data.reference,
                metadata: data.metadata,
                callback_url: process.env.PAYSTACK_CALLBACK_URL,
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
}
