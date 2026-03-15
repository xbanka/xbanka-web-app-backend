import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { IdentityPassService } from './integrations/identitypass.service';
import { ObiexService } from './integrations/obiex.service';

@Module({
  providers: [CommonService, IdentityPassService, ObiexService],
  exports: [CommonService, IdentityPassService, ObiexService],
})
export class CommonModule { }
