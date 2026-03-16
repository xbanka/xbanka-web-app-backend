import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { IdentityPassService } from './integrations/identitypass.service';
import { ObiexService } from './integrations/obiex.service';
import { NubanService } from './services/nuban.service';

@Module({
  providers: [CommonService, IdentityPassService, ObiexService, NubanService],
  exports: [CommonService, IdentityPassService, ObiexService, NubanService],
})
export class CommonModule { }
