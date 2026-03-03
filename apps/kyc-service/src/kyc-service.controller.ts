import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { KycServiceService } from './kyc-service.service';

@Controller()
export class KycServiceController {
  constructor(private readonly kycServiceService: KycServiceService) { }

  @MessagePattern({ cmd: 'verify-bvn' })
  async verifyBvn(@Payload() data: { userId: string; bvn: string }) {
    return this.kycServiceService.verifyBvn(data.userId, data.bvn);
  }
}
