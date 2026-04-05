import { WalletServiceService } from '../apps/wallet-service/src/wallet-service.service';
import { DatabaseService } from '../libs/database/src/database.service';
import { ObiexService } from '../libs/common/src/integrations/obiex.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyCanonicalFixes() {
    console.log('--- Verifying Obiex Canonical Pair Mapping ---');

    const prisma = new DatabaseService();
    const obiex = new ObiexService();
    const service = new WalletServiceService(prisma, obiex, null as any, null as any);

    const testCases = [
        { source: 'USDT', target: 'NGN', amount: 10, expectedSide: 'sell' },
        { source: 'NGN', target: 'USDT', amount: 14450, expectedSide: 'buy' },
        { source: 'BTC', target: 'USDT', amount: 0.1, expectedSide: 'sell' },
        { source: 'USDT', target: 'BTC', amount: 6000, expectedSide: 'buy' }
    ];

    for (const test of testCases) {
        console.log(`\n🧪 Testing: ${test.amount} ${test.source} -> ${test.target}`);
        try {
            const result = await service.calculateRate({ 
                source: test.source, 
                target: test.target, 
                amount: test.amount 
            });
            
            console.log(`✅ Result: ${result.sourceAmount} ${result.sourceCurrency} = ${result.grossPayout} ${result.targetCurrency}`);
            console.log(`   Estimated Price: ${result.estimatedPrice}`);
            
            if (result.grossPayout === 0) {
              console.error(`❌ Error: Payout is 0, logic might be failing.`);
            }

        } catch (error) {
            console.error(`❌ Failed: ${error.message}`);
        }
    }

    console.log('\n--- Verification Complete ---');
}

verifyCanonicalFixes();
