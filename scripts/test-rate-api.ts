import fetch from 'node-fetch'; // or use native fetch if Node >= 18
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testRateCalculator() {
    console.log('--- Testing Internal Rate Calculator API ---');

    const port = process.env.PORT || 3010;
    const internalKey = process.env.INTERNAL_API_KEY;
    const url = `http://localhost:${port}/internal/wallet/rate-calculator`;

    const payload = {
        sourceCurrency: 'USDT',
        targetCurrency: 'NGN',
        amount: 20
    };

    console.log(`Sending POST request to ${url}`);
    console.log('Payload:', payload);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-key': internalKey || ''
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('\nStatus Code:', response.status);
        console.log('Response Body:');
        console.log(JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('\n✅ Rate calculation via internal API successful.');
        } else {
            console.error('\n❌ API request failed.');
        }

    } catch (error) {
        console.error('Error making the request:', error);
        console.log('\nMake sure your NestJS server is running (e.g. npm run start:dev) before running this script.');
    }

    console.log('\n--- Test Complete ---');
}

testRateCalculator();
