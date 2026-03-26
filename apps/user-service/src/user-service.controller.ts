import { Controller, Get } from '@nestjs/common';
import { UserServiceService } from './user-service.service';

import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class UserServiceController {
  constructor(private readonly userServiceService: UserServiceService) { }

  @MessagePattern({ cmd: 'get-profile' })
  async getProfile(@Payload() data: { userId: string }) {
    return this.userServiceService.getProfile(data);
  }

  @MessagePattern({ cmd: 'update-profile' })
  async updateProfile(@Payload() data: any) {
    return this.userServiceService.updateProfile(data);
  }

  @MessagePattern({ cmd: 'skip-step' })
  async skipStep(@Payload() data: { userId: string }) {
    return this.userServiceService.skipStep(data.userId);
  }
}
