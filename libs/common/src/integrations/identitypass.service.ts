import { Injectable } from '@nestjs/common';
import { BaseIntegrationService } from '../services/base-integration.service';

@Injectable()
export class IdentityPassService extends BaseIntegrationService {
    protected readonly baseUrl = 'https://api.prembly.com'; // Placeholder
    protected readonly apiKey = process.env.IDENTITYPASS_API_KEY || '';

    async verifyBvn(bvn: string) {
        return this.post('/verifications/bvn', { bvn });
    }

    async verifyNin(nin: string) {
        return this.post('/verifications/nin', { nin });
    }
}
