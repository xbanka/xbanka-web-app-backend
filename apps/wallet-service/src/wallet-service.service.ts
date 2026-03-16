import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { DatabaseService } from '@app/database';
import { ObiexService } from '@app/common';
import { WalletType } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class WalletServiceService {
  private readonly logger = new Logger(WalletServiceService.name);

  constructor(
    private readonly prisma: DatabaseService,
    private readonly obiex: ObiexService,
  ) { }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async pollPendingTransactions() {
    this.logger.log('⏰ Running polling fallback for PENDING transactions...');

    // 1. Find PENDING transactions older than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const pendingTransactions = await this.prisma.transaction.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: fiveMinutesAgo },
      },
    });

    if (pendingTransactions.length === 0) {
      this.logger.log('✅ No stuck pending transactions found.');
      return;
    }

    this.logger.log(`🔍 Found ${pendingTransactions.length} pending transactions to check.`);

    for (const tx of pendingTransactions) {
      try {
        this.logger.log(`📡 Checking status for transaction ${tx.reference} via Obiex...`);
        const response: any = await this.obiex.getTransactionById(tx.reference);
        const obiexTx = response?.data || response;

        if (!obiexTx || !obiexTx.status) {
          this.logger.warn(`⚠️ Could not retrieve status for ${tx.reference}`);
          continue;
        }

        if (obiexTx.status === 'COMPLETED') {
          // Get the wallet to credit
          const wallet = await this.prisma.wallet.findFirst({
            where: { userId: tx.userId, currency: tx.currency },
          });

          if (!wallet) {
            this.logger.error(`❌ Wallet not found for user ${tx.userId} and currency ${tx.currency}`);
            continue;
          }

          const amount = obiexTx.amount || tx.amount;

          await this.prisma.$transaction([
            this.prisma.transaction.update({
              where: { id: tx.id },
              data: { status: 'COMPLETED', amount },
            }),
            this.prisma.wallet.update({
              where: { id: wallet.id },
              data: { balance: { increment: amount } },
            }),
          ]);
          this.logger.log(`✅ Transaction ${tx.reference} confirmed via polling. Credited ${amount} ${tx.currency}.`);
        } else if (obiexTx.status === 'FAILED') {
          await this.prisma.transaction.update({
            where: { id: tx.id },
            data: { status: 'FAILED' },
          });
          this.logger.warn(`❌ Transaction ${tx.reference} marked as FAILED via polling.`);
        } else {
          this.logger.log(`⏳ Transaction ${tx.reference} still ${obiexTx.status} at provider.`);
        }
      } catch (error) {
        this.logger.error(`❌ Error polling transaction ${tx.reference}: ${error.message}`);
      }
    }
  }

  async getWallets(userId: string) {
    this.logger.log(`💰 Fetching all wallets for user ${userId}`);
    return this.prisma.wallet.findMany({
      where: { userId },
      include: { addresses: true },
      orderBy: { type: 'asc' },
    });
  }

  async getWallet(userId: string, walletId: string) {
    this.logger.log(`💰 Fetching wallet ${walletId} for user ${userId}`);
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, userId },
      include: { addresses: true },
    });
    if (!wallet) {
      throw new RpcException({ message: 'Wallet not found', status: 404 });
    }
    return wallet;
  }

  private async getNgnRate(currency: string): Promise<number | null> {
    try {
      const quote: any = await this.obiex.createQuote(currency, 'NGN', 1);
      const rate = quote?.data?.rate || quote?.rate;
      return typeof rate === 'number' ? rate : null;
    } catch {
      this.logger.warn(`⚠️ Could not fetch NGN rate for ${currency}`);
      return null;
    }
  }

  async getCryptoWallets(userId: string) {
    this.logger.log(`🔐 Fetching crypto wallets for user ${userId}`);
    const wallets = await this.prisma.wallet.findMany({
      where: { userId, type: WalletType.CRYPTO },
      include: { addresses: true },
      orderBy: { currency: 'asc' },
    });

    // Fetch NGN rates for all unique currencies in parallel
    const uniqueCurrencies = [...new Set(wallets.map(w => w.currency))];
    const rateResults = await Promise.all(
      uniqueCurrencies.map(async (currency) => ({
        currency,
        rate: await this.getNgnRate(currency),
      }))
    );
    const rateMap = Object.fromEntries(rateResults.map(r => [r.currency, r.rate]));

    return wallets.map(wallet => {
      const rate = rateMap[wallet.currency];
      return {
        ...wallet,
        fiatEquivalent: rate !== null
          ? {
            currency: 'NGN',
            amount: parseFloat((wallet.balance * rate).toFixed(2)),
            rate,
          }
          : null,
      };
    });
  }

  async getFiatWallets(userId: string) {
    this.logger.log(`🏦 Fetching fiat wallets for user ${userId}`);
    return this.prisma.wallet.findMany({
      where: { userId, type: WalletType.FIAT },
      include: { addresses: true },
      orderBy: { currency: 'asc' },
    });
  }

  async getOrCreateCryptoDepositAddress(userId: string, currency: string, network: string) {
    this.logger.log(`🪙 Getting deposit address for user ${userId}, currency: ${currency}, network: ${network}`);

    // 1. Get or create the central crypto wallet
    const wallet = await this.prisma.wallet.upsert({
      where: { userId_currency: { userId, currency } },
      create: { userId, currency, balance: 0, type: WalletType.CRYPTO },
      update: {},
    });

    // 2. Check if an Obiex address already exists for this network
    const existingAddress = await this.prisma.walletAddress.findUnique({
      where: { walletId_provider_network: { walletId: wallet.id, provider: 'OBIEX', network } },
    });

    if (existingAddress) {
      this.logger.log(`✅ Found existing address for ${currency}/${network}`);
      return existingAddress;
    }

    // 3. Generate a new address via Obiex
    this.logger.log(`📡 Calling Obiex to generate address for ${currency}/${network}`);
    const obiexResponse = await this.obiex.createBrokerAddress('deposit', currency, network);
    const data: any = obiexResponse;

    // 4. Save the address to the database
    const newAddress = await this.prisma.walletAddress.create({
      data: {
        walletId: wallet.id,
        provider: 'OBIEX',
        network,
        address: data.address || data.data?.address,
        memo: data.memo || data.data?.memo,
        providerRef: data.id || data.data?.id,
      },
    });

    this.logger.log(`💡 New address created for ${currency}/${network}: ${newAddress.address}`);
    return newAddress;
  }

  async handleCryptoWebhook(payload: any, signature: string) {
    // 1. Validate HMAC signature from Obiex
    const expectedSig = require('crypto')
      .createHmac('sha256', process.env.OBIEX_API_SECRET || '')
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expectedSig) {
      this.logger.warn('⚠️ Invalid Obiex webhook signature — rejected');
      throw new RpcException({ message: 'Invalid webhook signature', status: 401 });
    }

    const { event, data } = payload;
    this.logger.log(`📨 Obiex webhook received: event=${event}`);

    if (event !== 'deposit.confirmed' && event !== 'transaction.updated') {
      this.logger.log(`⏭️ Ignoring Obiex event: ${event}`);
      return { received: true };
    }

    const { reference, amount, currency, network, address, status } = data;

    // 2. Find the wallet address this deposit was sent to
    const walletAddress = await this.prisma.walletAddress.findFirst({
      where: { address, network, provider: 'OBIEX' },
      include: { wallet: true },
    });

    if (!walletAddress) {
      this.logger.warn(`⚠️ No wallet address found for address ${address}/${network}`);
      return { received: true };
    }

    const { wallet } = walletAddress;

    // 3. Upsert transaction record
    const existing = await this.prisma.transaction.findUnique({ where: { reference } });

    if (existing && existing.status === 'COMPLETED') {
      this.logger.log(`⏭️ Transaction ${reference} already completed — skipping`);
      return { received: true };
    }

    if (status === 'COMPLETED') {
      await this.prisma.$transaction([
        this.prisma.transaction.upsert({
          where: { reference },
          create: {
            userId: wallet.userId,
            type: 'DEPOSIT',
            status: 'COMPLETED',
            amount,
            currency,
            reference,
            note: `Crypto deposit via ${network} (Obiex)`,
          },
          update: { status: 'COMPLETED', amount },
        }),
        this.prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } },
        }),
      ]);
      this.logger.log(`✅ Credited ${amount} ${currency} to wallet ${wallet.id} for user ${wallet.userId}`);
    } else if (status === 'FAILED') {
      await this.prisma.transaction.upsert({
        where: { reference },
        create: {
          userId: wallet.userId,
          type: 'DEPOSIT',
          status: 'FAILED',
          amount,
          currency,
          reference,
          note: `Failed crypto deposit via ${network} (Obiex)`,
        },
        update: { status: 'FAILED' },
      });
      this.logger.warn(`❌ Crypto deposit FAILED for ${reference}`);
    }

    return { received: true };
  }

  async handleFiatWebhook(payload: any, signature: string, provider: string) {
    this.logger.log(`📨 Fiat webhook received from provider: ${provider}`);

    // Validate signature per provider
    const secret = process.env.FIAT_WEBHOOK_SECRET || '';
    const expectedSig = require('crypto')
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expectedSig) {
      this.logger.warn(`⚠️ Invalid ${provider} webhook signature — rejected`);
      throw new RpcException({ message: 'Invalid webhook signature', status: 401 });
    }

    // Normalize across fiat providers (Flutterwave / Paystack / etc.)
    const { reference, amount, currency = 'NGN', status, userId } = payload?.data || payload;

    if (!reference || !userId) {
      this.logger.warn('⚠️ Fiat webhook missing reference or userId');
      return { received: true };
    }

    const existing = await this.prisma.transaction.findUnique({ where: { reference } });
    if (existing && existing.status === 'COMPLETED') {
      this.logger.log(`⏭️ Fiat transaction ${reference} already completed — skipping`);
      return { received: true };
    }

    const normalizedStatus = status === 'successful' || status === 'COMPLETED' ? 'COMPLETED' : 'FAILED';

    // Get or create the NGN fiat wallet
    const wallet = await this.prisma.wallet.upsert({
      where: { userId_currency: { userId, currency } },
      create: { userId, currency, balance: 0, type: 'FIAT' },
      update: {},
    });

    if (normalizedStatus === 'COMPLETED') {
      await this.prisma.$transaction([
        this.prisma.transaction.upsert({
          where: { reference },
          create: {
            userId,
            type: 'DEPOSIT',
            status: 'COMPLETED',
            amount,
            currency,
            reference,
            note: `Fiat deposit via ${provider}`,
          },
          update: { status: 'COMPLETED', amount },
        }),
        this.prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } },
        }),
      ]);
      this.logger.log(`✅ Credited ${amount} ${currency} to wallet ${wallet.id} for user ${userId}`);
    } else {
      await this.prisma.transaction.upsert({
        where: { reference },
        create: {
          userId,
          type: 'DEPOSIT',
          status: 'FAILED',
          amount: amount || 0,
          currency,
          reference,
          note: `Failed fiat deposit via ${provider}`,
        },
        update: { status: 'FAILED' },
      });
      this.logger.warn(`❌ Fiat deposit FAILED for ${reference}`);
    }

    return { received: true };
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

  async getTransactions(userId: string, page: number = 1, limit: number = 10) {
    this.logger.log(`📜 Fetching transactions for user ${userId} (page: ${page}, limit: ${limit})`);
    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.count({
        where: { userId },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items,
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }
}
