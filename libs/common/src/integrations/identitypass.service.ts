import { Injectable } from '@nestjs/common';
import { BaseIntegrationService } from '../services/base-integration.service';

@Injectable()
export class IdentityPassService extends BaseIntegrationService {
    protected readonly baseUrl = 'https://api.prembly.com'; // Placeholder
    protected readonly apiKey = process.env.IDENTITYPASS_API_KEY || '';

    async verifyBvn(bvn: string) {
        return this.post('/verification/bvn', { number: bvn }, {
            headers: {
                'x-api-key': this.apiKey,
                'Authorization': '', // Clear the default Bearer token if not needed, though x-api-key is the primary one here
            }
        });
    }

    async verifyNin(nin: string) {
        return this.post('/verification/nin', { number: nin }, {
            headers: {
                'x-api-key': this.apiKey,
                'Authorization': '',
            }
        });
    }
}
