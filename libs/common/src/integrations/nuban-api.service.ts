import { Injectable } from '@nestjs/common';
import { BaseIntegrationService } from '../services/base-integration.service';

@Injectable()
export class NubanApiService extends BaseIntegrationService {
    protected readonly baseUrl = 'https://app.nuban.com.ng';
    protected readonly apiKey = process.env.NUBAN_SECRET_KEY || '';

    /**
     * Resolves the account name for an account number.
     * If bankCode is provided, it uses the faster specific lookup.
     * If bankCode is NOT provided, it uses the account-only lookup.
     */
    async resolveAccountName(accountNumber: string, bankCode?: string) {
        this.logger.log(`🔍 Resolving account name for ${accountNumber}${bankCode ? ` at bank ${bankCode}` : ' (account only)'}`);

        // API Format: https://app.nuban.com.ng/api/YOUR-API-KEY?[bank_code=3-digits-code&]acc_no=10-digits-account-number
        let url = `${this.baseUrl}/api/${this.apiKey}?acc_no=${accountNumber}`;
        if (bankCode) {
            url += `&bank_code=${bankCode}`;
        }

        this.logger.debug(`📡 Request URL: ${url.replace(this.apiKey, 'REDACTED_KEY')}`);

        try {
            const response = await this.axios.get(url);
            this.logger.log(`✅ API Response for ${accountNumber}: ${JSON.stringify(response.data)}`);
            return response.data;
        } catch (error) {
            this.logger.error(`❌ Account resolution failed: ${error.message}${error.response ? ` | Response: ${JSON.stringify(error.response.data)}` : ''}`);
            throw error;
        }
    }

    /**
     * GUESS BANKS - Returns possible banks for a given 10-digit account number.
     * API Format: https://app.nuban.com.ng/possible-banks/YOUR-API-KEY?acc_no=10-digits-account-number
     */
    async getPossibleBanks(accountNumber: string) {
        this.logger.log(`🕵️ Guessing potential banks for NUBAN: ${accountNumber}`);
        const url = `${this.baseUrl}/possible-banks/${this.apiKey}?acc_no=${accountNumber}`;

        this.logger.debug(`📡 Request URL: ${url.replace(this.apiKey, 'REDACTED_KEY')}`);

        try {
            const response = await this.axios.get(url);
            this.logger.log(`✅ API Response (Possible Banks) for ${accountNumber}: ${JSON.stringify(response.data)}`);
            return response.data;
        } catch (error) {
            this.logger.error(`❌ Failed to guess banks: ${error.message}${error.response ? ` | Response: ${JSON.stringify(error.response.data)}` : ''}`);
            throw error;
        }
    }
}
