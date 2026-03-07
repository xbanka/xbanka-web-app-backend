import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { NotificationServiceService } from './notification-service.service';

@Controller()
export class NotificationServiceController {
  getHello(): any {
    throw new Error('Method not implemented.');
  }
  constructor(private readonly notificationService: NotificationServiceService) { }

  @MessagePattern('send_email')
  async handleSendEmail(@Payload() data: { to: string; subject: string; body: string }) {
    return this.notificationService.sendEmail(data.to, data.subject, data.body);
  }

  @MessagePattern('send_sms')
  async handleSendSms(@Payload() data: { to: string; message: string }) {
    return this.notificationService.sendSms(data.to, data.message);
  }
}
