import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthServiceService } from './auth-service.service';

@Controller()
export class AuthServiceController {
  getHello(): any {
    throw new Error('Method not implemented.');
  }
  constructor(private readonly authServiceService: AuthServiceService) { }

  @MessagePattern({ cmd: 'signup' })
  async signup(@Payload() data: any) {
    return this.authServiceService.signup(data);
  }
}
