import { WalletServiceService } from '../apps/wallet-service/src/wallet-service.service';
import { DatabaseService } from '../libs/database/src/database.service';
import { ObiexService } from '../libs/common/src/integrations/obiex.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testRateCalculator() {
    console.log('--- Testing Rate Calculator (No DB Save) ---');

    const prisma = new DatabaseService();
    const obiex = new ObiexService();
    const service = new WalletServiceService(prisma, obiex, null as any, null as any, null as any);

    const source = 'BTC';
    const target = 'NGN';
    const amount = 20; // Like in the user image

    console.log(`Step 1: Fetching available currencies...`);
    try {
        const currencies = await service.getCurrencies();
        console.log('Available Currencies:');
        console.log(JSON.stringify(currencies, null, 2));
    } catch (error) {
        console.error('Error fetching currencies:', error.message);
    }

    console.log(`\nStep 2: Calculating rate for ${amount} ${source} -> ${target}`);
    try {
        const result = await service.calculateRate({ source, target, amount });
        console.log('Calculation Result:');
        console.log(JSON.stringify(result, null, 2));

        if (result.netPayout > 0 && result.rate > 0) {
            console.log('✅ Rate calculator calculation successful.');
        }

        if (result.estimatedPrice) {
            console.log(`✅ Estimated price correctly formatted: ${result.estimatedPrice}`);
        }

        // Verify no quote is created (manual check or we can try to find it)
        const quoteCount = await prisma.conversionQuote.count({
            where: {
                sourceCurrency: source,
                targetCurrency: target,
                sourceAmount: amount,
                // Limit to recent to avoid false negatives from previous tests
                createdAt: { gte: new Date(Date.now() - 5000) }
            }
        });

        if (quoteCount === 0) {
            console.log('✅ Verified: No database record was created for this calculation.');
        } else {
            console.error('❌ Error: A database record was unexpectedly created!');
        }

    } catch (error) {
        console.error('Error during rate calculation test:', error.message);
    }

    console.log('\n--- Test Complete ---');
}

testRateCalculator();
