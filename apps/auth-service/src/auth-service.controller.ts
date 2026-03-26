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
  resendVerification(data: { email: string; redirectUrl: string }) {
    return this.authServiceService.resendVerification(data);
  }

  @MessagePattern({ cmd: 'verify-device' })
  verifyDevice(@Payload() data: { userId: string; deviceId: string; code: string }) {
    return this.authServiceService.verifyDevice(data);
  }

  @MessagePattern({ cmd: 'get-sessions' })
  getSessions(@Payload() userId: string) {
    return this.authServiceService.getSessions(userId);
  }

  @MessagePattern({ cmd: 'revoke-session' })
  revokeSession(@Payload() data: { userId: string; sessionId: string }) {
    return this.authServiceService.revokeSession(data);
  }

  @MessagePattern({ cmd: 'get-devices' })
  getDevices(@Payload() userId: string) {
    return this.authServiceService.getDevices(userId);
  }

  @MessagePattern({ cmd: 'remove-device' })
  removeDevice(@Payload() data: { userId: string; deviceId: string }) {
    return this.authServiceService.removeDevice(data);
  }

  @MessagePattern({ cmd: 'validate-session' })
  validateSession(@Payload() data: { sessionId: string; userId: string }) {
    return this.authServiceService.validateSession(data);
  }

  @MessagePattern({ cmd: 'request-security-otp' })
  async requestSecurityOtp(@Payload() data: { userId: string }) {
    return this.authServiceService.requestSecurityOtp(data.userId);
  }

  @MessagePattern({ cmd: 'change-password' })
  async changePassword(@Payload() data: any) {
    return this.authServiceService.changePassword(data);
  }

  @MessagePattern({ cmd: 'create-pin' })
  async createPin(@Payload() data: any) {
    return this.authServiceService.createPin(data);
  }

  @MessagePattern({ cmd: 'update-pin' })
  async updatePin(@Payload() data: any) {
    return this.authServiceService.updatePin(data);
  }

  @MessagePattern({ cmd: 'validate-pin' })
  async validatePin(@Payload() data: any) {
    return this.authServiceService.validatePin(data);
  }

  @MessagePattern({ cmd: 'generate-2fa-secret' })
  async generate2faSecret(@Payload() data: { userId: string }) {
    return this.authServiceService.generate2faSecret(data.userId);
  }

  @MessagePattern({ cmd: 'enable-2fa' })
  async enable2fa(@Payload() data: any) {
    return this.authServiceService.enable2fa(data);
  }

  @MessagePattern({ cmd: 'disable-2fa' })
  async disable2fa(@Payload() data: any) {
    return this.authServiceService.disable2fa(data);
  }

  @MessagePattern({ cmd: 'verify-2fa-login' })
  async verify2faLogin(@Payload() data: any) {
    return this.authServiceService.verify2faLogin(data);
  }
}
