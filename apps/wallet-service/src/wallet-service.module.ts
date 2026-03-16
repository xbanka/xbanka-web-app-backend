import { Module } from '@nestjs/common';
import { WalletServiceController } from './wallet-service.controller';
import { WalletServiceService } from './wallet-service.service';
import { DatabaseModule } from '@app/database';
import { CommonModule } from '@app/common';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [WalletServiceController],
  providers: [WalletServiceService],
})
export class WalletServiceModule { }
