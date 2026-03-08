import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '@app/database';
import { TradeStatus } from '@prisma/client';
import { Subject, interval, map, Observable } from 'rxjs';

@Injectable()
export class GiftCardServiceService implements OnModuleInit {
    private readonly rateUpdates$ = new Subject<any>();

    constructor(private readonly prisma: DatabaseService) { }

    async onModuleInit() {
        await this.seedInitialData();
        this.startRateSimulation();
    }

    private async seedInitialData() {
        const categories = ['PHYSICAL', 'ECODE', 'CASH RECEIPT', 'DEBIT RECEIPT'];
        const regions = ['USA', 'UK', 'CANADA', 'GERMANY', 'NIGERIA', 'GHANA', 'SOUTH AFRICA', 'SWITZERLAND'];

        // seeding categories
        for (const name of categories) {
            const exists = await this.prisma.giftCardCategory.findUnique({ where: { name } });
            if (!exists) {
                await this.prisma.giftCardCategory.create({ data: { name } });
            }
        }

        // seeding regions
        for (const name of regions) {
            const exists = await this.prisma.giftCardRegion.findUnique({ where: { name } });
            if (!exists) {
                await this.prisma.giftCardRegion.create({ data: { name } });
            }
        }

        const brandCount = await this.prisma.giftCard.count();
        if (brandCount === 0) {
            // 3. Brands
            const apple = await this.prisma.giftCard.create({ data: { name: 'Apple', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg' } });
            const amazon = await this.prisma.giftCard.create({ data: { name: 'Amazon', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg' } });
            const steam = await this.prisma.giftCard.create({ data: { name: 'Steam', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg' } });

            const physical = await this.prisma.giftCardCategory.findUnique({ where: { name: 'PHYSICAL' } });
            const ecode = await this.prisma.giftCardCategory.findUnique({ where: { name: 'ECODE' } });
            const cashReceipt = await this.prisma.giftCardCategory.findUnique({ where: { name: 'CASH RECEIPT' } });
            const usa = await this.prisma.giftCardRegion.findUnique({ where: { name: 'USA' } });
            const uk = await this.prisma.giftCardRegion.findUnique({ where: { name: 'UK' } });

            // 4. Variants
            await this.prisma.giftCardVariant.createMany({
                data: [
                    { cardId: apple.id, categoryId: physical.id, regionId: usa.id, rate: 750, dailyChange: 1.2 },
                    { cardId: apple.id, categoryId: cashReceipt.id, regionId: usa.id, rate: 800, dailyChange: 1.5 },
                    { cardId: apple.id, categoryId: ecode.id, regionId: usa.id, rate: 700, dailyChange: 0.5 },
                    { cardId: amazon.id, categoryId: physical.id, regionId: usa.id, rate: 780, dailyChange: 2.1 },
                    { cardId: steam.id, categoryId: ecode.id, regionId: uk.id, rate: 650, dailyChange: -0.2 },
                ],
            });
        }
    }

    private startRateSimulation() {
        interval(15000).subscribe(async () => {
            const variants = await this.prisma.giftCardVariant.findMany({
                include: { card: true, category: true, region: true },
            });

            const updates = variants.map(v => ({
                id: v.id,
                cardName: v.card.name,
                categoryName: v.category.name,
                regionName: v.region.name,
                rate: v.rate + (Math.random() > 0.5 ? 1 : -1),
                dailyChange: v.dailyChange + (Math.random() * 0.05),
            }));

            this.rateUpdates$.next(updates);
        });
    }

    async getGiftCards() {
        return this.prisma.giftCard.findMany({
            where: { isActive: true },
            include: {
                variants: {
                    where: { isActive: true },
                    include: { category: true, region: true },
                },
            },
        });
    }

    async getCategories() {
        return this.prisma.giftCardCategory.findMany({ where: { isActive: true } });
    }

    async getRegions() {
        return this.prisma.giftCardRegion.findMany({ where: { isActive: true } });
    }

    getRateUpdates(): Observable<any> {
        return this.rateUpdates$.asObservable();
    }

    async sellGiftCard(userId: string, data: any) {
        const variant = await this.prisma.giftCardVariant.findUnique({
            where: { id: data.variantId },
            include: { card: true },
        });

        if (!variant || !variant.isActive) {
            throw new Error('This gift card variant is not available for trading');
        }

        const payout = data.amount * variant.rate;

        return this.prisma.giftCardTrade.create({
            data: {
                userId,
                cardId: variant.cardId,
                variantId: variant.id,
                categoryId: variant.categoryId,
                regionId: variant.regionId,
                amount: data.amount,
                payout,
                code: data.code,
                imageUrl: data.imageUrl,
                status: TradeStatus.PENDING,
            },
        });
    }

    async getTradingOverview(userId: string) {
        const trades = await this.prisma.giftCardTrade.findMany({
            where: { userId },
            include: { card: true },
        });

        const cardsSold = trades.length;
        const totalPayout = trades.reduce((sum, trade) => sum + trade.payout, 0);

        const cardCounts = trades.reduce((acc, trade) => {
            acc[trade.card.name] = (acc[trade.card.name] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const topCardName = Object.entries(cardCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

        return { cardsSold, totalPayout, topTradedCard: topCardName };
    }

    async getPayoutTrend(userId: string) {
        const trades = await this.prisma.giftCardTrade.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
        });

        const trend = trades.reduce((acc, trade) => {
            const date = trade.createdAt.toISOString().split('T')[0];
            acc[date] = (acc[date] || 0) + trade.payout;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(trend).map(([date, amount]) => ({ date, amount }));
    }
}
