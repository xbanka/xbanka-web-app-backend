import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@app/database';

@Injectable()
export class WalletServiceService {
  private readonly logger = new Logger(WalletServiceService.name);

  constructor(private readonly prisma: DatabaseService) { }

  async getWallets(userId: string) {
    this.logger.log(`💰 Fetching wallets for user ${userId}`);
    return this.prisma.wallet.findMany({
      where: { userId },
    });
  }

  async addBankDetail(userId: string, data: { bankName: string; accountNumber: string; accountName: string }) {
    this.logger.log(`🏦 Adding bank for user ${userId}: ${data.bankName}`);
    return this.prisma.bankDetail.create({
      data: {
        userId,
        ...data,
      },
    });
  }

  async getBankDetails(userId: string) {
    this.logger.log(`🏦 Fetching banks for user ${userId}`);
    return this.prisma.bankDetail.findMany({
      where: { userId },
    });
  }

  async getTransactions(userId: string) {
    this.logger.log(`📜 Fetching transactions for user ${userId}`);
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
