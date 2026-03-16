import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { IdentityPassService } from './integrations/identitypass.service';
import { ObiexService } from './integrations/obiex.service';
import { NubanApiService } from './integrations/nuban-api.service';
import { NubanService } from './services/nuban.service';

@Module({
  providers: [CommonService, IdentityPassService, ObiexService, NubanApiService, NubanService],
  exports: [CommonService, IdentityPassService, ObiexService, NubanApiService, NubanService],
})
export class CommonModule { }
