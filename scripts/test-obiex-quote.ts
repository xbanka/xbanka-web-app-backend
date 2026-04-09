import { ObiexService } from '../libs/common/src/integrations/obiex.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runTest() {
    const obiex = new ObiexService();
    
    // Test parameters
    const sourceId = 'BTC';
    const targetId = 'NGNX';
    const amount = 20; // 10 USDT
    const side = 'BUY'; // Selling USDT to get NGNX

    console.log('=========================================');
    console.log('🚀 TESTING OBIEX CREATE QUOTE');
    console.log('=========================================');
    
    const requestPayload = { sourceId, targetId, amount, side };
    console.log('\n📡 REQUEST DETAILS:');
    console.log('Method: POST');
    console.log('Path:   /trades/quote');
    console.log('Body:  ', JSON.stringify(requestPayload, null, 2));

    try {
        const response: any = await obiex.createQuote(sourceId, targetId, amount, side);
        
        console.log('\n✅ RESPONSE RECEIVED:');
        console.log(JSON.stringify(response, null, 2));
        
        console.log('\n-----------------------------------------');
        console.log('💡 SUMMARY:');
        if (response.data) {
            const d = response.data;
            console.log(`Rate:           ${d.rate}`);
            console.log(`Amount In:      ${d.amount} ${d.sourceCode}`);
            console.log(`Amount Out:     ${d.amountReceived} ${d.targetCode}`);
            console.log(`Quote ID:       ${d.id}`);
            console.log(`Expires:        ${d.expiryDate}`);
        } else {
             console.log(`Rate:           ${response.rate}`);
            console.log(`Amount In:      ${response.amount} ${response.sourceCode}`);
            console.log(`Amount Out:     ${response.amountReceived} ${response.targetCode}`);
            console.log(`Quote ID:       ${response.id}`);
            console.log(`Expires:        ${response.expiryDate}`);
        }
        console.log('=========================================');

    } catch (error) {
        console.error('\n❌ TEST FAILED:');
        if (error.response?.data) {
            console.error('Error Body:', JSON.stringify(error.response.data, null, 2));
        } else if (error.details) {
            console.error('Error Details:', JSON.stringify(error.details, null, 2));
        } else {
            console.error('Error Message:', error.message);
        }
        console.log('=========================================');
    }
}

runTest();
