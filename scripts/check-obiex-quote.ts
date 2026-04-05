import { ObiexService } from '../libs/common/src/integrations/obiex.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkObiexQuote() {
  const obiex = new ObiexService();
  
  // Testing Canonical Pair: USDT (Source) / NGNX (Target)
  // According to Obiex Team: 
  // SELL (Source -> Target): provide USDT, receive NGNX
  // BUY (Target -> Source): provide NGNX, receive USDT
  
  const sourceId = 'USDT';
  const targetId = 'NGNX';
  const amount = 14450; // We hope this is interpreted as 14,450 NGNX
  const side = 'buy'; 

  console.log(`--- Checking Obiex Quote for ${amount} ${sourceId} -> ${targetId} ---`);
  
  try {
    // We use the createQuote method which handles the API-KEY, TIMESTAMP, and SIGNATURE automatically
    const response: any = await obiex.createQuote(sourceId, targetId, amount, side);
    const data = response.data || response;

    console.log('✅ Quote successful!');
    console.log('\n--- Full Response Body ---');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n--- Key Fields ---');
    console.log(`Rate: ${data.rate}`);
    console.log(`Payout (amountReceived): ${data.amountReceived}`);
    console.log(`Expiry (expiryDate): ${data.expiryDate}`);
    console.log(`Side: ${data.side}`);
    
  } catch (error) {
    console.error('❌ Quote failed!');
    console.error(`Message: ${error.message}`);
    if (error.response?.data) {
      console.error('Error Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkObiexQuote();
