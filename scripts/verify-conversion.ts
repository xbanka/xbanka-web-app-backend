import { WalletServiceService } from '../apps/wallet-service/src/wallet-service.service';
import { DatabaseService } from '../libs/database/src/database.service';
import { ObiexService } from '../libs/common/src/integrations/obiex.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyConversion() {
    console.log('--- Verifying Crypto Conversion with Fees ---');

    // Mock dependencies or use real ones if available
    const prisma = new DatabaseService();
    const obiex = new ObiexService();
    const service = new WalletServiceService(prisma, obiex, null as any, null as any);

    const source = 'USDT';
    const target = 'NGN';
    const amount = 100;

    console.log(`Step 1: Testing Quote for ${amount} ${source} -> ${target}`);
    try {
        // We'll just test the fee calculation logic if we don't want to call real APIs
        // but since we have the keys, let's try a real quote if possible
        const quote = await service.getConversionQuote('test-user-id', source, target, amount);
        console.log('Quote received:');
        console.log(JSON.stringify(quote, null, 2));

        if (quote.adminFee > 0 || quote.netPayout < quote.grossPayout) {
            console.log('✅ Admin fee correctly applied to quote.');
        } else {
            console.log('ℹ️ No admin fee applied (check if RateConfiguration exists in DB).');
        }
    } catch (error) {
        console.error('Error during quote verification:', error.message);
    }

    console.log('\n--- Verification Complete ---');
}

verifyConversion();
