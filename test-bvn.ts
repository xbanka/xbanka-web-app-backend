import axios from 'axios';

async function testBvnVerification() {
    const baseUrl = 'http://localhost:3010';
    const email = `testuser_${Date.now()}@example.com`;
    const password = 'Password123!';

    try {
        // 1. Signup
        console.log('🚀 Step 1: Signing up...');
        const signupRes = await axios.post(`${baseUrl}/auth/signup`, {
            email,
            password,
            redirectUrl: 'http://localhost:3000/verify'
        });
        const userId = signupRes.data.id;
        console.log(`✅ Signup successful. User ID: ${userId}`);

        // 2. Update Profile with names matching the Prembly sample response
        // Prembly sample: firstName: "JU", lastName: "KEE"
        console.log('🚀 Step 2: Updating profile names...');
        await axios.post(`${baseUrl}/users/profile`, {
            userId,
            firstName: 'JU',
            lastName: 'KEE',
            dateOfBirth: '1990-01-01T00:00:00.000Z',
            phoneNumber: '+2348012345678',
            gender: 'Female',
            country: 'Nigeria'
        });
        console.log('✅ Profile updated.');

        // 3. Verify BVN
        // We use the sample BVN from the prembly response: "22289000017"
        console.log('🚀 Step 3: Verifying BVN...');
        const bvnRes = await axios.post(`${baseUrl}/kyc/verify-bvn`, {
            userId,
            bvn: '22289000017'
        });
        console.log('✅ BVN verification result:', JSON.stringify(bvnRes.data, null, 2));

    } catch (error) {
        console.error('❌ Test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

testBvnVerification();
