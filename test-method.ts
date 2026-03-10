import 'dotenv/config';
import { IdentityPassService } from './libs/common/src/integrations/identitypass.service';

async function testIdentityPassMethod() {
    // We need to provide the IdentityPassService with its dependencies or mock its base class behavior.
    // Since IdentityPassService extends BaseIntegrationService which uses axios, 
    // and we want to test the literal method call and its generated URL/Payload.

    // For a quick standalone test of the method logic:
    const service = new IdentityPassService();

    // Mocking the post method to see what it tries to do
    (service as any).post = async (url: string, data: any) => {
        console.log('📡 Intercepted POST request:');
        console.log(`URL: ${url}`);
        console.log('Data:', JSON.stringify(data, null, 2));
        return { status: true, message: 'Mocked response' };
    };

    const testBvn = '22289000017';
    console.log(`🚀 Testing verifyBvn with BVN: ${testBvn}`);

    try {
        await service.verifyBvn(testBvn);
        console.log('✅ Method call successful (Mocked).');
    } catch (error) {
        console.error('❌ Method call failed:', error.message);
    }
}

testIdentityPassMethod();
