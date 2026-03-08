import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GiftCardServiceService } from './gift-card-service.service';

@Controller()
export class GiftCardServiceController {
    constructor(private readonly giftCardService: GiftCardServiceService) { }

    @MessagePattern('get_gift_cards')
    async getGiftCards() {
        return this.giftCardService.getGiftCards();
    }

    @MessagePattern('get_categories')
    async getCategories() {
        return this.giftCardService.getCategories();
    }

    @MessagePattern('get_regions')
    async getRegions() {
        return this.giftCardService.getRegions();
    }

    @MessagePattern('sell_gift_card')
    async sellGiftCard(@Payload() data: { userId: string; payload: any }) {
        return this.giftCardService.sellGiftCard(data.userId, data.payload);
    }

    @MessagePattern('get_trading_overview')
    async getTradingOverview(@Payload() data: { userId: string }) {
        return this.giftCardService.getTradingOverview(data.userId);
    }

    @MessagePattern('get_payout_trend')
    async getPayoutTrend(@Payload() data: { userId: string }) {
        return this.giftCardService.getPayoutTrend(data.userId);
    }

    @MessagePattern('get_rate_updates')
    getRateUpdates() {
        return this.giftCardService.getRateUpdates();
    }
}
