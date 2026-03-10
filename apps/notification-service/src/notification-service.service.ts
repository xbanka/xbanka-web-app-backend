import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class NotificationServiceService {
  private readonly logger = new Logger(NotificationServiceService.name);
  private resend: Resend;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = new Resend(apiKey);
  }

  async sendEmail(to: string, subject: string, body: string, from?: string): Promise<boolean> {
    try {
      this.logger.log(`📧 Sending Email to ${to}: [${subject}]`);

      const { data, error } = await this.resend.emails.send({
        from: from || 'Xbanka <notifications@xbankang.com>',
        to: [to],
        subject: subject,
        html: body,
      });

      if (error) {
        this.logger.error(`❌ Failed to send email via Resend: ${error.message}`);
        return false;
      }

      this.logger.log(`✅ Email sent successfully: ${data?.id}`);
      return true;
    } catch (err) {
      this.logger.error(`❌ Error sending email via Resend: ${err.message}`);
      return false;
    }
  }

  async sendSms(to: string, message: string): Promise<boolean> {
    this.logger.log(`📱 Sending SMS to ${to}: ${message}`);
    // TODO: Integrate with Termii or Twilio
    return true;
  }
}
