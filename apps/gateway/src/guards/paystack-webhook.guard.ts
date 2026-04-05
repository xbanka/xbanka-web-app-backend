import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PaystackWebhookGuard implements CanActivate {
  private readonly logger = new Logger(PaystackWebhookGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-paystack-signature'];

    /**
     * STAGING NOTE: Signature verification is implemented below but commented out
     * for easier testing as per user request.
     */
    
    /*
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      this.logger.error('❌ PAYSTACK_SECRET_KEY is not defined');
      return false;
    }

    const hash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(request.body))
      .digest('hex');

    if (hash !== signature) {
      this.logger.warn('⚠️ Invalid Paystack webhook signature');
      return false;
    }
    */

    this.logger.log('✅ Paystack Webhook bypass (staging mode)');
    return true;
  }
}
