import { ObiexService } from './libs/common/src/integrations/obiex.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function debugObiex() {
    const obiex = new ObiexService();
    
    console.log('--- Debugging Obiex Pairs ---');
    try {
        const pairs: any = await obiex.getGroupedPairs();
        const data = pairs.data || pairs;
        
        console.log('Grouped Pairs (JSON):');
        console.log(JSON.stringify(data, null, 2));

        const ngnGroup = data.find((g: any) => g.code === 'NGNX' || g.code === 'NGN');
        if (ngnGroup) {
            console.log(`\nFound group for ${ngnGroup.code}:`);
            console.log(ngnGroup.pairs);
        } else {
            console.log('\n❌ No NGN or NGNX group found in grouped pairs.');
        }

    } catch (error) {
        console.error('Error fetching grouped pairs:', error.message);
    }

    const testPairs = [
        { source: 'USDT', target: 'NGNX', side: 'sell' },
        { source: 'NGNX', target: 'USDT', side: 'buy' },
        { source: 'USDT', target: 'NGNX' },
        { source: 'NGNX', target: 'USDT' }
    ];

    console.log('\n--- Testing Quotes ---');
    for (const pair of testPairs) {
        try {
            console.log(`Testing ${pair.source} -> ${pair.target} (side: ${pair.side || 'none'})...`);
            const payload: any = { 
                sourceId: pair.source, 
                targetId: pair.target, 
                amount: 100 
            };
            if (pair.side) payload.side = pair.side;
            
            const quote: any = await (obiex as any).post('/trades/quote', payload, {
                headers: (obiex as any).getObiexHeaders('POST', '/trades/quote')
            });
            console.log(`✅ Success! Response keys: ${Object.keys(quote.data || quote)}`);
            console.log(`   Side in response: ${(quote.data || quote).side}`);
        } catch (error) {
            console.error(`❌ Failed: ${error.message}`);
            if (error.details) {
                console.error(`   Details: ${JSON.stringify(error.details)}`);
            }
        }
    }
}

debugObiex();
