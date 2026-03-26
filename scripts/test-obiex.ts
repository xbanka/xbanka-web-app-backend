import { ObiexService } from '../libs/common/src/integrations/obiex.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testObiex() {
    // ObiexService is a class, we can instantiate it directly
    // since it doesn't have any constructor-injected dependencies
    const obiexService = new ObiexService();

    console.log('Testing ObiexService.getCurrencies()...');
    try {
        const currencies = await obiexService.getCurrencies();
        console.log('Currencies fetched successfully:');
        console.log(JSON.stringify(currencies, null, 2));
    } catch (error) {
        console.error('Error fetching currencies:', error.response?.data || error.message);
    }
}

testObiex();
