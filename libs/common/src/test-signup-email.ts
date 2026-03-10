import axios from 'axios';

async function testSignupEmail() {
    const signupData = {
        email: 'abdulkabiru@xbankang.com',
        password: 'TestPassword123!',
        redirectUrl: 'https://xbankang.com/verify'
    };

    try {
        console.log('🚀 Triggering signup via Gateway...');
        // Port 3010 is the Gateway port from .env
        const response = await axios.post('http://localhost:3010/auth/signup', signupData);
        console.log('✅ Signup successful!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Signup failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

testSignupEmail();
