import { Resend } from 'resend';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.RESEND_API_KEY;
const resend = new Resend(apiKey);

async function testEmail() {
  console.log('Testing Resend with API Key:', apiKey?.substring(0, 5) + '...');
  try {
    const { data, error } = await resend.emails.send({
      from: 'Xbanka <notifications@xbankang.com>',
      to: ['ayodeji@xbankang.com'], // Using the email from the user's request
      subject: 'Test Resend from Script',
      html: '<p>Testing Resend integration from script.</p>',
    });

    if (error) {
      console.error('❌ Failed to send email via Resend:', error);
    } else {
      console.log('✅ Email sent successfully:', data);
    }
  } catch (err) {
    console.error('❌ Error sending email via Resend:', err);
  }
}

testEmail();
