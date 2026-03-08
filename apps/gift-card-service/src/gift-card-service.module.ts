import { Module } from '@nestjs/common';
import { GiftCardServiceController } from './gift-card-service.controller';
import { GiftCardServiceService } from './gift-card-service.service';
import { DatabaseModule } from '@app/database';

@Module({
    imports: [DatabaseModule],
    controllers: [GiftCardServiceController],
    providers: [GiftCardServiceService],
})
export class GiftCardServiceModule { }
