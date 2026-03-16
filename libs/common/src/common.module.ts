import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { IdentityPassService } from './integrations/identitypass.service';
import { ObiexService } from './integrations/obiex.service';
import { NubanApiService } from './integrations/nuban-api.service';
import { PaystackService } from './integrations/paystack.service';
import { NubanService } from './services/nuban.service';

@Module({
  providers: [CommonService, IdentityPassService, ObiexService, NubanApiService, PaystackService, NubanService],
  exports: [CommonService, IdentityPassService, ObiexService, NubanApiService, PaystackService, NubanService],
})
export class CommonModule { }
