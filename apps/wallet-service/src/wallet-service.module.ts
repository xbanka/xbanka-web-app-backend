import { Module } from '@nestjs/common';
import { WalletServiceController } from './wallet-service.controller';
import { WalletServiceService } from './wallet-service.service';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [DatabaseModule],
  controllers: [WalletServiceController],
  providers: [WalletServiceService],
})
export class WalletServiceModule { }
