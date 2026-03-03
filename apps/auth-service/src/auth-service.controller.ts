import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthServiceService } from './auth-service.service';

@Controller()
export class AuthServiceController {
  constructor(private readonly authServiceService: AuthServiceService) { }

  @MessagePattern({ cmd: 'signup' })
  async signup(@Payload() data: any) {
    return this.authServiceService.signup(data);
  }

  @MessagePattern({ cmd: 'verify-email' })
  async verifyEmail(@Payload() data: { email: string }) {
    return this.authServiceService.verifyEmail(data.email);
  }
}
