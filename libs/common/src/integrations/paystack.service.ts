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
}
