import { Module } from '@nestjs/common';
import { KycServiceController } from './kyc-service.controller';
import { KycServiceService } from './kyc-service.service';
import { DatabaseModule } from '@app/database';
import { IdentityPassService } from '@app/common';

@Module({
  imports: [DatabaseModule],
  controllers: [KycServiceController],
  providers: [KycServiceService, IdentityPassService],
})
export class KycServiceModule { }
