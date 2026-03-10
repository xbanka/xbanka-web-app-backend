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
  async verifyEmail(@Payload() data: { token: string }) {
    return this.authServiceService.verifyEmail(data.token);
  }

  @MessagePattern({ cmd: 'login' })
  async login(@Payload() data: any) {
    return this.authServiceService.login(data);
  }

  @MessagePattern({ cmd: 'google-login' })
  async googleLogin(@Payload() data: any) {
    return this.authServiceService.googleLogin(data);
  }

  @MessagePattern({ cmd: 'resend-verification' })
  async resendVerification(@Payload() data: { email: string; redirectUrl: string }) {
    return this.authServiceService.resendVerification(data);
  }
}
