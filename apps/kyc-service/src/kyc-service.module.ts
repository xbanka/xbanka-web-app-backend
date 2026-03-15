import { Module } from '@nestjs/common';
import { KycServiceController } from './kyc-service.controller';
import { KycServiceService } from './kyc-service.service';
import { DatabaseModule } from '@app/database';
import { IdentityPassService, ObiexService } from '@app/common';

@Module({
  imports: [DatabaseModule],
  controllers: [KycServiceController],
  providers: [KycServiceService, IdentityPassService, ObiexService],
})
export class KycServiceModule { }
