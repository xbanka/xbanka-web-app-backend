import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { DatabaseService } from '@app/database';
import { ObiexService, NubanService, NubanApiService, PaystackService } from '@app/common';
import { WalletType } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Subject, Observable } from 'rxjs';
import axios from 'axios';

@Injectable()
export class WalletServiceService {
  private readonly logger = new Logger(WalletServiceService.name);
  private readonly marketUpdates$ = new Subject<any>();

  constructor(
    private readonly prisma: DatabaseService,
    private readonly obiex: ObiexService,
    private readonly nuban: NubanService,
    private readonly nubanApi: NubanApiService,
    private readonly paystack: PaystackService,
  ) { }

  @Cron(CronExpression.EVERY_MINUTE)
  async updateMarketPrices() {
    this.logger.log('📈 Fetching real-time market prices from CoinCap...');
    try {
      const baseUrl = process.env.COINCAP_BASE_URL || 'https://api.coincap.io/v2';
      const apiKey = process.env.COINCAP_API_KEY;
      
      const config: any = {
        params: {
          limit: 20 // Get top 20 assets
        }
      };

      if (apiKey) {
        config.headers = {
          'Authorization': `Bearer ${apiKey}`
        };
      }

      const response = await axios.get(`${baseUrl}/assets`, config);

      const assets = response.data?.data || [];
      if (!assets.length) {
        return { success: false, message: 'No assets found from provider' };
      }

      const updates = await Promise.all(assets.map(async (asset: any) => {
        const data = {
          symbol: asset.symbol,
          name: asset.name,
          priceUsd: parseFloat(asset.priceUsd),
          changePercent24h: parseFloat(asset.changePercent24Hr),
          rank: parseInt(asset.rank),
        };

        return (this.prisma as any).cryptoMarketData.upsert({
          where: { symbol: data.symbol },
          create: data,
          update: data,
        });
      }));

      this.marketUpdates$.next(updates);
      const symbols = updates.map((u: any) => u.symbol).join(', ');
      this.logger.log(`✅ Updated ${updates.length} market prices: [${symbols}]`);
      
      return { 
        success: true, 
        count: updates.length, 
        symbols: updates.map((u: any) => u.symbol) 
      };
    } catch (error) {
      this.logger.error(`❌ Failed to update market prices: ${error.message}`);
      throw new RpcException(`Failed to sync market prices: ${error.message}`);
    }
  }

  getMarketPriceUpdates(): Observable<any> {
    return this.marketUpdates$.asObservable();
  }

  async getLatestMarketPrices(page: number = 1, limit: number = 10) {
    this.logger.log(`📈 Fetching latest market prices (page: ${page}, limit: ${limit})`);
    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      (this.prisma as any).cryptoMarketData.findMany({
        skip,
        take: limit,
        orderBy: { rank: 'asc' },
      }),
      (this.prisma as any).cryptoMarketData.count(),
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

  async getDirectDebitBanks() {
    return this.paystack.getDirectDebitBanks();
  }

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

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async refreshBankList() {
    this.logger.log('⏰ Running scheduled bank list refresh...');
    await this.nuban.refreshBanks();
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
      const quote: any = await this.obiex.createQuote(currency, 'NGNX', 1, 'sell');
      const data = quote?.data || quote;
      const rate = data?.rate;
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

  async resetCryptoWallets(userId: string) {
    this.logger.log(`🗑️ Resetting crypto assets for user ${userId}`);

    // 1. Delete all addresses for the user's crypto wallets
    await this.prisma.walletAddress.deleteMany({
      where: {
        wallet: {
          userId,
          type: WalletType.CRYPTO,
        },
      },
    });

    // 2. Delete the crypto wallets themselves
    await this.prisma.wallet.deleteMany({
      where: {
        userId,
        type: WalletType.CRYPTO,
      },
    });

    return { message: 'Crypto assets reset successfully' };
  }

  async getFiatWallets(userId: string) {
    this.logger.log(`🏦 Fetching fiat wallets for user ${userId}`);
    return this.prisma.wallet.findMany({
      where: { userId, type: WalletType.FIAT },
      include: { addresses: true },
      orderBy: { currency: 'asc' },
    });
  }

  async logWebhook(data: { source: string; event?: string; payload: any; headers?: any; status?: string; errorMessage?: string }) {
    this.logger.log(`📝 Logging incoming webhook from ${data.source} (Event: ${data.event})`);
    return this.prisma.webhookLog.create({
      data: {
        source: data.source,
        event: data.event,
        payload: JSON.stringify(data.payload),
        headers: data.headers ? JSON.stringify(data.headers) : null,
        status: data.status || 'PENDING',
        errorMessage: data.errorMessage,
      },
    });
  }

  async updateWebhookStatus(id: string, status: string, errorMessage?: string) {
    return this.prisma.webhookLog.update({
      where: { id },
      data: { status, errorMessage },
    });
  }

  async getWebhookLogs(query: { source?: string; status?: string; limit?: number; offset?: number }) {
    const { source, status, limit = 50, offset = 0 } = query;
    const where: any = {};
    if (source) where.source = source;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      this.prisma.webhookLog.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.webhookLog.count({ where }),
    ]);

    return {
      logs: logs.map(log => ({
        ...log,
        payload: JSON.parse(log.payload),
        headers: log.headers ? JSON.parse(log.headers) : null,
      })),
      total,
      limit,
      offset,
    };
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
        address: data.address || data.data?.address || data.value || data.data?.value,
        memo: data.memo || data.data?.memo,
        providerRef: data.id || data.data?.id,
      },
    });

    this.logger.log(`💡 New address created for ${currency}/${network}: ${newAddress.address}`);
    return newAddress;
  }

  async handleCryptoWebhook(payload: any, signature: string) {
    if (!payload || !signature) {
      this.logger.warn('⚠️ Missing payload or signature — rejected');
      return { status: 'failed', message: 'Missing data' };
    }

    // 1. Validate HMAC signature from Obiex
    const secret = process.env.OBIEX_API_SECRET || process.env.OBIEX_SECRET || '';
    
    // Debug logs for signature troubleshooting
    this.logger.debug(`🔑 Webhook Secret Found: ${secret ? secret.substring(0, 4) + '...' + secret.substring(secret.length - 4) : 'MISSING'}`);
    
    const expectedSig = require('crypto')
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expectedSig) {
      this.logger.warn('⚠️ Invalid Obiex webhook signature — rejected');
      this.logger.debug(`🛡️ Received: ${signature}`);
      this.logger.debug(`🛡️ Expected: ${expectedSig}`);
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
      await this.prisma.$transaction(async (tx) => {
        await tx.transaction.upsert({
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
        });

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } },
        });

        // Save card if requested and reusable (Paystack formatting)
        const authorization = payload?.data?.authorization;
        if (payload?.data?.metadata?.saveCard === true && authorization?.reusable === true) {
          await tx.savedCard.create({
            data: {
              userId,
              authorizationCode: authorization.authorization_code,
              cardType: authorization.card_type,
              last4: authorization.last4,
              expMonth: authorization.exp_month,
              expYear: authorization.exp_year,
              bank: authorization.bank,
              countryCode: authorization.country_code,
              brand: authorization.brand,
              reusable: true,
            },
          });
          this.logger.log(`💳 Webhook saved card for user ${userId}: ${authorization.last4}`);
        }
      });
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

  async addBankDetail(userId: string, data: { bankName: string; accountNumber: string; accountName: string; bankCode: string }) {
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

  async getTransactions(userId: string, page: number = 1, limit: number = 10, category?: string) {
    this.logger.log(`📜 Fetching transactions for user ${userId} (page: ${page}, limit: ${limit}, category: ${category})`);
    const skip = (page - 1) * limit;

    let items: any[] = [];
    let totalItems = 0;

    if (category === 'GIFTCARD') {
      [items, totalItems] = await Promise.all([
        this.prisma.giftCardTrade.findMany({
          where: { userId },
          include: { card: true, category: true, region: true },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.giftCardTrade.count({
          where: { userId },
        }),
      ]);

      // Map to unified format
      items = items.map(trade => ({
        id: trade.id,
        type: 'TRADE',
        status: trade.status,
        amount: trade.payout, // Payout in NGN
        currency: 'NGN',
        reference: trade.id,
        note: `Gift Card Sale: ${trade.card.name} (${trade.category.name})`,
        createdAt: trade.createdAt,
        updatedAt: trade.updatedAt,
        category: 'GIFTCARD',
        metadata: JSON.stringify({
          usdAmount: trade.amount,
          variantId: trade.variantId,
          region: trade.region.name,
        }),
      }));
    } else {
      // For FIAT and CRYPTO, we filter regular transactions
      const where: any = { userId };

      if (category === 'FIAT' || category === 'CRYPTO') {
        where.user = {
          wallets: {
            some: {
              type: category,
              // This is a bit complex in Prisma to join on currency directly in 'where'
              // but since transactions are linked to wallets via userId and currency,
              // we can use a more direct approach if we assume currency defines type.
            }
          }
        };
        // Refined approach: filter by currency groups
        if (category === 'FIAT') {
          where.currency = 'NGN';
        } else {
          where.currency = { not: 'NGN' };
        }
      }

      [items, totalItems] = await Promise.all([
        this.prisma.transaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.transaction.count({
          where,
        }),
      ]);

      items = items.map(tx => ({
        ...tx,
        category: tx.currency === 'NGN' ? 'FIAT' : 'CRYPTO',
      }));
    }

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

  async getBanksForAccount(accountNumber: string) {
    this.logger.log(`🔍 Finding banks for NUBAN: ${accountNumber}`);
    return this.nuban.getBanksForAccount(accountNumber);
  }

  async generateNuban(bankCode: string, serialNumber: string) {
    this.logger.log(`🏗️ Generating NUBAN for bank ${bankCode}, serial: ${serialNumber}`);
    const generatedNuban = this.nuban.generateNuban(serialNumber, bankCode);
    const bank = this.nuban.getBanks().find((b) => b.code === bankCode);
    return {
      serialNumber: serialNumber.padStart(9, '0'),
      nuban: generatedNuban,
      bankCode,
      bank,
    };
  }

  async resolveAccountName(accountNumber: string, bankCode?: string) {
    this.logger.log(`🔍 Received account resolution request for ${accountNumber}${bankCode ? ` at bank ${bankCode}` : ''}`);
    try {
      return await this.nubanApi.resolveAccountName(accountNumber, bankCode);
    } catch (error) {
      throw new RpcException(error.message);
    }
  }

  async getPossibleBanks(accountNumber: string) {
    this.logger.log(`🕵️ Getting possible banks for ${accountNumber}`);
    try {
      return await this.nubanApi.getPossibleBanks(accountNumber);
    } catch (error) {
      throw new RpcException(error.message);
    }
  }

  async getAllBanks() {
    this.logger.log('🏦 Fetching all supported banks...');
    return this.nuban.getBanks();
  }

  private async calculateAdminFee(source: string, target: string, amount: number) {
    const config = await this.prisma.rateConfiguration.findUnique({
      where: { sourceCurrency_targetCurrency: { sourceCurrency: source, targetCurrency: target } },
    });

    if (!config || !config.isActive) {
      return 0;
    }

    if (config.feeType === 'FIXED') {
      return config.feeValue;
    } else {
      return (amount * config.feeValue) / 100;
    }
  }

  async getConversionQuote(userId: string, source: string, target: string, amount: number, action?: string) {
    this.logger.log(`🔄 Getting conversion quote for user ${userId}: ${amount} ${source} -> ${target} (action: ${action || 'auto'})`);

    const pSource = source === 'NGN' ? 'NGNX' : source;
    const pTarget = target === 'NGN' ? 'NGNX' : target;

    // 1. Find canonical pair and determine side
    const pairs: any = await this.obiex.getPairs();
    const pairsData = pairs.data || pairs;
    const pair = pairsData.find((p: any) => 
      (p.source.code === pSource && p.target.code === pTarget) ||
      (p.source.code === pTarget && p.target.code === pSource)
    );

    if (!pair) {
      this.logger.error(`❌ Trade pair ${source}/${target} not available on provider`);
      throw new RpcException({ message: `Trade pair ${source}/${target} not available`, status: 400 });
    }

    const canonicalSource = pair.source.code;
    const canonicalTarget = pair.target.code;
    const side = action?.toLowerCase() || (pSource === canonicalSource ? 'sell' : 'buy');

    this.logger.log(`🔗 Canonical Map: ${source}->${target} => Pair: ${canonicalSource}/${canonicalTarget}, Side: ${side}, Amount: ${amount}`);

    // 2. Get live quote from Obiex with correct side
    const obiexQuote: any = await this.obiex.createQuote(canonicalSource, canonicalTarget, amount, side);
    const data = obiexQuote.data || obiexQuote;

    // 3. Normalize payout and rate based on side
    // Obiex 'buy' returns amountToReceive (source) in amountReceived and amountToPay (target) in amount.
    const isBuy = side === 'buy';
    const grossPayout = isBuy ? data.amount : (data.amountReceived || data.payout || data.amount);
    const normalizedRate = isBuy ? (data.amount / data.amountReceived) : data.rate;

    // 4. Calculate admin fee
    const fee = await this.calculateAdminFee(source, target, grossPayout || 0);
    const netPayout = (grossPayout || 0) - fee;

    // 5. Robust expiry parsing (Obiex uses expiryDate)
    const rawExpiry = data.expiryDate || data.expiresAt || data.expiry || data.expires_at;
    const expiresAt = rawExpiry ? new Date(rawExpiry) : new Date(Date.now() + 5 * 60 * 1000);

    // 6. Store quote internally for logging and to hide Obiex ID
    const quote = await this.prisma.conversionQuote.create({
      data: {
        userId,
        obiexQuoteId: data.id || data.quoteId,
        sourceCurrency: source,
        targetCurrency: target,
        sourceAmount: amount,
        rate: normalizedRate,
        grossPayout: grossPayout || 0,
        adminFee: fee,
        netPayout,
        expiresAt: isNaN(expiresAt.getTime()) ? new Date(Date.now() + 5 * 60 * 1000) : expiresAt,
      },
    });

    this.logger.log(`✅ Saved internal quote: ${quote.id} (Obiex ID: ${quote.obiexQuoteId}, Side: ${side})`);

    return {
      quoteId: quote.id,
      sourceCurrency: source,
      targetCurrency: target,
      sourceAmount: amount,
      rate: normalizedRate,
      grossPayout: grossPayout,
      adminFee: fee,
      netPayout: netPayout,
      expiresAt: quote.expiresAt,
    };
  }

  async calculateRate(data: { source: string; target: string; amount: number; action?: string }) {
    this.logger.log(`🔍 Calculating rate: ${data.amount} ${data.source} -> ${data.target} (action: ${data.action || 'auto'})`);

    const pSource = data.source === 'NGN' ? 'NGNX' : data.source;
    const pTarget = data.target === 'NGN' ? 'NGNX' : data.target;

    // 1. Find canonical pair and determine side
    const pairs: any = await this.obiex.getPairs();
    const pairsData = pairs.data || pairs;
    const pair = pairsData.find((p: any) => 
      (p.source.code === pSource && p.target.code === pTarget) ||
      (p.source.code === pTarget && p.target.code === pSource)
    );

    if (!pair) {
      this.logger.error(`❌ Trade pair ${data.source}/${data.target} not available on provider`);
      throw new RpcException({ message: `Trade pair ${data.source}/${data.target} not available`, status: 400 });
    }

    const canonicalSource = pair.source.code;
    const canonicalTarget = pair.target.code;
    const side = data.action?.toLowerCase() || (pSource === canonicalSource ? 'sell' : 'buy');

    this.logger.log(`🔗 Canonical Map (Rate): ${data.source}->${data.target} => Pair: ${canonicalSource}/${canonicalTarget}, Side: ${side}`);

    // 2. Get live quote from Obiex — intercept minimum-amount errors for a clear user message
    let obiexQuote: any;
    try {
      obiexQuote = await this.obiex.getExchangeRate(canonicalSource, canonicalTarget, data.amount, side);
    } catch (err) {
      const details = err?.error?.details || err?.details;
      const errors: any[] = Array.isArray(details?.errors) ? details.errors : [];
      const minimumError = errors.find((e: any) => /minimum/i.test(e.message));
      if (minimumError) {
        // Extract the minimum value from Obiex's error message, e.g. "Amount is below minimum of 1,446 NGNX"
        const match = minimumError.message.match(/minimum of ([\d,]+(?:\.\d+)?)\s*(\w+)/i);
        const minAmount = match ? match[1] : '?';
        const minCurrency = match ? match[2].replace('NGNX', 'NGN') : data.target;
        this.logger.warn(`⚠️ Rate calculator rejected amount ${data.amount}: below minimum of ${minAmount} ${minCurrency}`);
        throw new RpcException({
          message: `Minimum amount is ${minAmount} ${minCurrency}.`,
          status: 400,
        });
      }
      throw err; // re-throw unexpected errors as-is
    }
    const quoteData = obiexQuote.data || obiexQuote;

    // 3. Normalize payout and rate based on side
    const isBuy = side === 'buy';
    const grossPayout = isBuy ? quoteData.amount : (quoteData.amountReceived || quoteData.payout || quoteData.amount);
    const normalizedRate = isBuy ? (quoteData.amount / quoteData.amountReceived) : quoteData.rate;

    // 4. Calculate admin fee
    const fee = await this.calculateAdminFee(data.source, data.target, grossPayout || 0);
    const netPayout = (grossPayout || 0) - fee;

    return {
      sourceCurrency: data.source,
      targetCurrency: data.target,
      sourceAmount: data.amount,
      rate: normalizedRate,
      grossPayout: grossPayout || 0,
      adminFee: fee,
      netPayout,
      estimatedPrice: `1 ${data.source} ≈ ${normalizedRate.toLocaleString()} ${data.target}`,
    };
  }

  async getCurrencies() {
    this.logger.log(`🔍 Fetching available currencies from provider`);
    return this.obiex.getCurrencies();
  }

  async getGroupedPairs() {
    this.logger.log(`🔍 Fetching grouped tradeable pairs from provider`);
    return this.obiex.getGroupedPairs();
  }

  async getPairs() {
    this.logger.log(`🔍 Fetching all tradeable pairs from provider`);
    return this.obiex.getPairs();
  }

  async executeConversion(userId: string, quoteId: string, source: string, target: string, amount: number) {
    this.logger.log(`🚀 Executing conversion for user ${userId} using internal quote: ${quoteId}`);

    // 1. Fetch internal quote and validate
    const quote = await this.prisma.conversionQuote.findUnique({
      where: { id: quoteId },
    });

    if (!quote || quote.userId !== userId) {
      this.logger.error(`❌ Invalid or missing quote attempt: user=${userId}, quote=${quoteId}`);
      throw new RpcException({ message: 'Invalid or missing conversion quote', status: 400 });
    }

    if (new Date() > quote.expiresAt) {
      this.logger.warn(`⚠️ Quote expired: user=${userId}, quote=${quoteId}`);
      throw new RpcException({ message: 'Conversion quote has expired', status: 400 });
    }

    // 2. Validate source wallet balance
    const sourceWallet = await this.prisma.wallet.findUnique({
      where: { userId_currency: { userId, currency: source } },
    });

    if (!sourceWallet || sourceWallet.balance < amount) {
      throw new RpcException({ message: 'Insufficient balance in source wallet', status: 400 });
    }

    // 3. Execute swap via Obiex (using the original provider ID)
    const obiexResponse: any = await this.obiex.swap(source, target, amount, quote.obiexQuoteId);
    const data = obiexResponse.data || obiexResponse;

    // 4. Calculate final payout and fee (re-calculate based on actual execution if provided by Obiex)
    const grossPayout = data.amount || data.payout || quote.grossPayout;
    const fee = await this.calculateAdminFee(source, target, grossPayout);
    const netPayout = grossPayout - fee;

    // 5. Atomic balance update and transaction record
    return this.prisma.$transaction(async (tx) => {
      // Create destination wallet if it doesn't exist
      const targetWallet = await tx.wallet.upsert({
        where: { userId_currency: { userId, currency: target } },
        create: { userId, currency: target, balance: 0, type: target === 'NGN' ? 'FIAT' : 'CRYPTO' },
        update: {},
      });

      // Update balances
      await tx.wallet.update({
        where: { id: sourceWallet.id },
        data: { balance: { decrement: amount } },
      });

      await tx.wallet.update({
        where: { id: targetWallet.id },
        data: { balance: { increment: netPayout } },
      });

      // Create transaction record
      return tx.transaction.create({
        data: {
          userId,
          type: 'CONVERSION',
          status: 'COMPLETED',
          amount: netPayout,
          currency: target,
          reference: data.id || `CONV-${Date.now()}`,
          note: `Converted ${amount} ${source} to ${target} (Fee: ${fee} ${target})`,
          metadata: JSON.stringify({
            sourceCurrency: source,
            targetCurrency: target,
            sourceAmount: amount,
            grossPayout,
            adminFee: fee,
            internalQuoteId: quoteId,
            obiexId: data.id,
          }),
        },
      });
    });
  }
  private validateCryptoAddress(address: string, network: string): boolean {
    const patterns = {
      'BITCOIN': /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/,
      'ERC20': /^0x[a-fA-F0-9]{40}$/,
      'TRC20': /^T[a-zA-Z0-9]{33}$/,
      'BEP20': /^0x[a-fA-F0-9]{40}$/,
    };

    const pattern = patterns[network.toUpperCase()];
    if (!pattern) return true; // Default to true if network not in list (let provider validate)
    
    return pattern.test(address);
  }

  async withdrawCrypto(userId: string, data: any) {
    const { currency, network, address, amount, memo, narration } = data;
    this.logger.log(`📤 Withdrawal request: user=${userId}, amount=${amount} ${currency}, network=${network}, address=${address}`);

    // 1. Validate Address
    if (!this.validateCryptoAddress(address, network)) {
      this.logger.warn(`❌ Invalid address for ${network}: ${address}`);
      throw new RpcException({ message: `Invalid ${network} address format`, status: 400 });
    }

    // 2. Lock Funds & Create Pending Transaction
    const transaction = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId_currency: { userId, currency } },
      });

      if (!wallet || wallet.balance < amount) {
        throw new RpcException({ message: 'Insufficient balance', status: 400 });
      }

      // Deduct balance (Locking)
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      });

      // Create Pending Transaction record
      return tx.transaction.create({
        data: {
          userId,
          type: 'WITHDRAWAL',
          status: 'PENDING',
          amount,
          currency,
          reference: `WD-${Date.now()}`,
          note: narration || `Withdrawal of ${amount} ${currency} to ${address}`,
          metadata: JSON.stringify({ address, network, memo }),
        },
      });
    });

    try {
      // 3. Call External Provider (Obiex)
      const obiexResponse: any = await this.obiex.withdrawCrypto({
        destination: { address, network, memo },
        amount,
        currency,
        narration: narration || `Withdrawal from XBanka`,
      });

      const providerData = obiexResponse.data || obiexResponse;

      // 4. Update Transaction on Success
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED',
          reference: providerData.id || transaction.reference,
        },
      });

      this.logger.log(`✅ Withdrawal COMPLETED: ${transaction.id}`);
      return transaction;

    } catch (error) {
      this.logger.error(`❌ Withdrawal FAILED at provider: ${error.message}`);

      // 5. Automatic Refund on Failure
      await this.prisma.$transaction([
        this.prisma.wallet.update({
          where: { userId_currency: { userId, currency } },
          data: { balance: { increment: amount } },
        }),
        this.prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'FAILED',
            note: (transaction.note || '') + ` (Error: ${error.message})`,
          },
        }),
      ]);

      throw new RpcException({ message: `Withdrawal failed: ${error.message}`, status: 500 });
    }
  }

  async initiateFiatDeposit(userId: string, amount: number, callback_url?: string, saveCard?: boolean) {
    this.logger.log(`🔄 Initiating fiat deposit for user ${userId}: ${amount} NGN`);

    // 1. Ensure user has a fiat wallet
    const wallet = await this.prisma.wallet.upsert({
      where: { userId_currency: { userId, currency: 'NGN' } },
      create: { userId, currency: 'NGN', type: 'FIAT', balance: 0 },
      update: {},
    });

    // 2. Create pending transaction
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        type: 'DEPOSIT',
        status: 'PENDING',
        amount,
        currency: 'NGN',
        reference: `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        note: `Funding NGN wallet via Paystack`,
      },
    });

    // 3. Initialize Paystack
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new RpcException({ message: 'User not found', status: 404 });

    const paystackResponse = await this.paystack.initializeTransaction({
      email: user.email,
      amount,
      reference: transaction.reference,
      metadata: { userId, transactionId: transaction.id, saveCard },
      callback_url,
    });

    return {
      transactionId: transaction.id,
      reference: transaction.reference,
      ...paystackResponse.data,
    };
  }

  async tokenizeCard(userId: string, callback_url?: string) {
    this.logger.log(`💳 Initiating card tokenization for user ${userId}`);

    const amount = 50; // Fixed verification amount

    // 1. Ensure NGN wallet exists
    await this.prisma.wallet.upsert({
      where: { userId_currency: { userId, currency: 'NGN' } },
      create: { userId, currency: 'NGN', type: 'FIAT', balance: 0 },
      update: {},
    });

    // 2. Create pending transaction
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        type: 'DEPOSIT',
        status: 'PENDING',
        amount,
        currency: 'NGN',
        reference: `TOK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        note: `Card tokenization verification`,
      },
    });

    // 3. Initialize Paystack with forced CARD channel
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new RpcException({ message: 'User not found', status: 404 });

    const paystackResponse = await this.paystack.initializeTransaction({
      email: user.email,
      amount,
      reference: transaction.reference,
      channels: ['card'],
      metadata: { userId, transactionId: transaction.id, saveCard: true },
      callback_url,
    });

    return {
      transactionId: transaction.id,
      reference: transaction.reference,
      ...paystackResponse.data,
    };
  }

  async verifyFiatDeposit(reference: string) {
    this.logger.log(`🔍 [Verify] Starting verification for reference: ${reference}`);

    // 1. Fetch transaction
    const transaction = await this.prisma.transaction.findUnique({
      where: { reference },
    });

    if (!transaction) {
      this.logger.warn(`❌ [Verify] Transaction not found for reference: ${reference}`);
      throw new RpcException({ message: 'Transaction not found', status: 404 });
    }

    this.logger.log(`📄 [Verify] Found transaction: ID=${transaction.id}, Type=${transaction.type}, Status=${transaction.status}`);

    if (transaction.type !== 'DEPOSIT') {
      this.logger.warn(`⚠️ [Verify] Invalid transaction type: ${transaction.type}. Expected DEPOSIT.`);
      throw new RpcException({ message: 'Invalid transaction type', status: 400 });
    }

    if (transaction.status === 'COMPLETED') {
      this.logger.log(`⏭️ [Verify] Transaction ${reference} is already COMPLETED. Skipping.`);
      return { status: 'SUCCESS', message: 'Transaction already completed', transaction };
    }

    // 2. Verify with Paystack
    this.logger.log(`📡 [Verify] Calling Paystack API to verify reference: ${reference}`);
    const paystackResponse = await this.paystack.verifyTransaction(reference);
    const data = paystackResponse.data;

    if (!data) {
      this.logger.error(`❌ [Verify] Paystack returned no data for reference: ${reference}`);
      throw new RpcException({ message: 'Verification failed: No data from provider', status: 500 });
    }

    this.logger.log(`📊 [Verify] Paystack Status: ${data.status}, Amount: ${data.amount} ${data.currency}`);

    if (data.status === 'success') {
      const amount = data.amount / 100; // Paystack returns in kobo
      this.logger.log(`💰 [Verify] Converting kobo to base units: ${data.amount} -> ${amount} ${transaction.currency}`);

      // 3. Atomic update
      this.logger.log(`💾 [Verify] Starting database transaction to credit wallet and update status...`);
      return this.prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({
          where: { userId_currency: { userId: transaction.userId, currency: transaction.currency } },
        });

        if (!wallet) {
          this.logger.error(`❌ [Verify] Wallet not found for user ${transaction.userId} and currency ${transaction.currency}`);
          throw new RpcException({ message: 'Wallet not found', status: 404 });
        }

        this.logger.log(`💳 [Verify] Crediting wallet ${wallet.id}: Balance ${wallet.balance} -> ${wallet.balance + amount}`);
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } },
        });

        this.logger.log(`📝 [Verify] Updating transaction ${transaction.id} status to COMPLETED`);
        const updatedTx = await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: 'COMPLETED', amount },
        });

        // Save card if requested and reusable
        const saveCardRequested = data.metadata?.saveCard === true;
        const cardIsReusable = data.authorization?.reusable === true;
        
        this.logger.log(`🤔 [Verify] Card Saving Check: Requested=${saveCardRequested}, Reusable=${cardIsReusable}`);

        if (saveCardRequested && cardIsReusable) {
          this.logger.log(`✨ [Verify] Tokenizing and saving card for user ${transaction.userId}`);
          await tx.savedCard.create({
            data: {
              userId: transaction.userId,
              authorizationCode: data.authorization.authorization_code,
              cardType: data.authorization.card_type,
              last4: data.authorization.last4,
              expMonth: data.authorization.exp_month,
              expYear: data.authorization.exp_year,
              bank: data.authorization.bank,
              countryCode: data.authorization.country_code,
              brand: data.authorization.brand,
              reusable: true,
            },
          });
          this.logger.log(`✅ [Verify] Card successfully saved: ${data.authorization.brand} **** ${data.authorization.last4}`);
        } else if (saveCardRequested && !cardIsReusable) {
          this.logger.warn(`⚠️ [Verify] Card save requested but card is NOT reusable according to Paystack.`);
        }

        this.logger.log(`🎉 [Verify] Verification process completed successfully for ${reference}`);
        return { status: 'SUCCESS', transaction: updatedTx };
      });
    }

    this.logger.warn(`❌ [Verify] Paystack verification failed: Status is ${data.status}`);
    return { status: data.status, message: 'Transaction not successful on Paystack' };
  }

  async initiateDirectDebit(userId: string, callback_url?: string, accountNumber?: string, bankCode?: string, amount?: number) {
    this.logger.log(`🔄 Initiating direct debit for user ${userId}`);

    // Validate bank code if provided for direct debit
    const supportedBanks = [
      '044', '023', '050', '214', '070', '011', '058', '030', 
      '082', '076', '101', '221', '068', '232', '100', '032', 
      '033', '215', '035', '057'
    ];

    if (bankCode && !supportedBanks.includes(bankCode)) {
      throw new RpcException({ message: 'Bank not supported for direct debit by Paystack.', status: 400 });
    }

    if ((bankCode && !accountNumber) || (!bankCode && accountNumber)) {
      throw new RpcException({ message: 'Both accountNumber and bankCode must be provided together, or neither.', status: 400 });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new RpcException({ message: 'User not found', status: 404 });

    const reference = `DD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create a pending mandate record
    const mandate = await this.prisma.directDebitMandate.create({
      data: {
        userId,
        provider: 'PAYSTACK',
        reference,
        status: 'PENDING',
      },
    });

    const payload: any = {
      email: user.email,
      callback_url,
      reference,
      amount,
    };

    if (accountNumber && bankCode) {
      payload.account = {
        number: accountNumber,
        bank_code: bankCode,
      };
    }

    const paystackResponse = await this.paystack.initializeDirectDebitAuthorization(payload);

    return {
      mandateId: mandate.id,
      reference: mandate.reference,
      ...paystackResponse.data,
    };
  }

  async verifyDirectDebit(reference: string) {
    this.logger.log(`🔍 Verifying direct debit mandate: ${reference}`);

    const mandate = await this.prisma.directDebitMandate.findUnique({
      where: { reference },
    });

    if (!mandate) throw new RpcException({ message: 'Mandate not found', status: 404 });

    const paystackResponse = await this.paystack.verifyAuthorization(reference);
    const data = paystackResponse.data;

    if (data.authorization_code) {
      const updatedMandate = await this.prisma.directDebitMandate.update({
        where: { id: mandate.id },
        data: {
          authorizationCode: data.authorization_code,
          bank: data.bank,
          accountName: data.account_name,
          last4: data.last4,
          expMonth: data.exp_month,
          expYear: data.exp_year,
          channel: data.channel,
          status: 'ACTIVE',
        },
      });

      this.logger.log(`✅ Mandate ${mandate.id} verified and ACTIVE.`);
      return { status: 'SUCCESS', mandate: updatedMandate };
    }

    return { status: 'PENDING', message: 'Mandate not yet fully active on provider' };
  }

  async chargeDirectDebit(userId: string, mandateId: string, amount: number) {
    this.logger.log(`💸 Charging direct debit ${mandateId} for user ${userId}, amount ${amount}`);

    const mandate = await this.prisma.directDebitMandate.findUnique({
      where: { id: mandateId, userId },
    });

    if (!mandate) throw new RpcException({ message: 'Mandate not found', status: 404 });
    if (mandate.status !== 'ACTIVE' || !mandate.authorizationCode) {
      throw new RpcException({ message: 'Mandate is not active', status: 400 });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new RpcException({ message: 'User not found', status: 404 });

    const reference = `CHG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create pending deposit transaction representing this direct charge
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        type: 'DEPOSIT',
        status: 'PENDING',
        amount,
        currency: 'NGN',
        reference,
        note: `Direct Debit charge via ${mandate.provider}`,
      },
    });

    const paystackResponse = await this.paystack.chargeAuthorization({
      authorization_code: mandate.authorizationCode,
      email: user.email,
      amount,
      reference,
      currency: 'NGN',
    });

    return {
      message: 'Processing charge request',
      transactionId: transaction.id,
      reference: transaction.reference,
      status: paystackResponse.data.status,
    };
  }

  async deactivateDirectDebit(userId: string, mandateId: string) {
    this.logger.log(`🛑 Deactivating direct debit mandate ${mandateId} for user ${userId}`);

    const mandate = await this.prisma.directDebitMandate.findUnique({
      where: { id: mandateId, userId },
    });

    if (!mandate) throw new RpcException({ message: 'Mandate not found', status: 404 });

    if (mandate.authorizationCode) {
      await this.paystack.deactivateAuthorization(mandate.authorizationCode);
    }

    const updatedMandate = await this.prisma.directDebitMandate.update({
      where: { id: mandate.id },
      data: { status: 'INACTIVE' },
    });

    return { status: 'SUCCESS', mandate: updatedMandate };
  }

  async handleDirectDebitWebhook(payload: any) {
    const { event, data } = payload;
    this.logger.log(`📨 Received Direct Debit webhook: ${event}`);

    // If active or created, and it contains an authorization code, we can try to look it up using user email
    // but without the exact reference it might be tricky unless metadata was passed. 
    // Thankfully, Paystack usually includes the customer code or email inside the data.customer object.
    if (event === 'direct_debit.authorization.created' || event === 'direct_debit.authorization.active') {
      const email = data.customer?.email;
      if (!email) {
        this.logger.warn('⚠️ Webhook data missing customer email for authorization mapping');
        return { received: true };
      }

      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        this.logger.warn(`⚠️ User not found for webhook email: ${email}`);
        return { received: true };
      }

      // Find the most recent pending mandate for this user.
      const mandate = await this.prisma.directDebitMandate.findFirst({
        where: { userId: user.id, status: 'PENDING', provider: 'PAYSTACK' },
        orderBy: { createdAt: 'desc' },
      });

      if (!mandate) {
        this.logger.warn(`⚠️ No pending mandate found for user ${user.id} to attach authorization_code`);
        return { received: true };
      }

      // Update mandate
      await this.prisma.directDebitMandate.update({
        where: { id: mandate.id },
        data: {
          authorizationCode: data.authorization_code,
          bank: data.bank,
          accountName: data.account_name,
          last4: data.last4,
          expMonth: data.exp_month,
          expYear: data.exp_year,
          channel: data.channel,
          status: event === 'direct_debit.authorization.active' ? 'ACTIVE' : 'PENDING',
        },
      });

      this.logger.log(`✅ Webhook updated mandate ${mandate.id} to ${event === 'direct_debit.authorization.active' ? 'ACTIVE' : 'PENDING (with code)'}`);
    }

    return { received: true };
  }

  async getSavedCards(userId: string) {
    this.logger.log(`💳 Fetching saved cards for user ${userId}`);
    return this.prisma.savedCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        last4: true,
        expMonth: true,
        expYear: true,
        bank: true,
        brand: true,
        cardType: true,
        createdAt: true,
      },
    });
  }

  async chargeSavedCard(userId: string, savedCardId: string, amount: number) {
    this.logger.log(`💸 Charging saved card ${savedCardId} for user ${userId}, amount ${amount}`);

    const savedCard = await this.prisma.savedCard.findUnique({
      where: { id: savedCardId, userId },
    });

    if (!savedCard || !savedCard.authorizationCode) {
      throw new RpcException({ message: 'Saved card not found or invalid', status: 404 });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new RpcException({ message: 'User not found', status: 404 });

    const reference = `SC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        type: 'DEPOSIT',
        status: 'PENDING',
        amount,
        currency: 'NGN',
        reference,
        note: `Wallet funding via saved card`,
      },
    });

    const paystackResponse = await this.paystack.chargeAuthorization({
      authorization_code: savedCard.authorizationCode,
      email: user.email,
      amount,
      reference,
      currency: 'NGN',
    });

    return {
      message: 'Processing saved card charge request',
      transactionId: transaction.id,
      reference: transaction.reference,
      status: paystackResponse.data.status,
    };
  }

  async deleteSavedCard(userId: string, cardId: string) {
    this.logger.log(`🗑️ Deleting saved card ${cardId} for user ${userId}`);

    const card = await this.prisma.savedCard.findUnique({
      where: { id: cardId, userId },
    });

    if (!card) throw new RpcException({ message: 'Saved card not found', status: 404 });

    await this.prisma.savedCard.delete({
      where: { id: cardId },
    });

    return { status: 'SUCCESS', message: 'Saved card deleted successfully' };
  }

  async withdrawFiat(userId: string, data: { bankDetailId?: string; accountNumber?: string; bankCode?: string; accountName?: string; amount: number; narration?: string }) {
    const { bankDetailId, amount, narration, accountNumber, bankCode, accountName } = data;
    this.logger.log(`📤 Fiat Withdrawal request: user=${userId}, amount=${amount} NGN, bankDetailId=${bankDetailId || 'NONE (One-off)'}`);

    let targetBank = {
      bankName: '',
      accountNumber: '',
      accountName: '',
      bankCode: '',
    };

    // 1. Resolve bank details (either from saved ID or from payload)
    if (bankDetailId) {
      const bankDetail = await this.prisma.bankDetail.findUnique({
        where: { id: bankDetailId, userId },
      });

      if (!bankDetail) {
        this.logger.warn(`❌ Bank detail not found for ID: ${bankDetailId}`);
        throw new RpcException({ message: 'Linked bank account not found', status: 404 });
      }
      targetBank = {
        bankName: bankDetail.bankName,
        accountNumber: bankDetail.accountNumber,
        accountName: bankDetail.accountName,
        bankCode: bankDetail.bankCode,
      };
    } else {
      // Validate one-off bank details
      if (!accountNumber || !bankCode || !accountName) {
        throw new RpcException({ message: 'Missing bank details for one-off withdrawal (accountNumber, bankCode, and accountName are required if no bankDetailId is provided)', status: 400 });
      }
      targetBank = {
        bankName: 'One-off External Bank',
        accountNumber,
        accountName,
        bankCode,
      };
    }

    // 2. Lock Funds & Create Pending Transaction
    const transaction = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId_currency: { userId, currency: 'NGN' } },
      });

      if (!wallet || wallet.balance < amount) {
        throw new RpcException({ message: 'Insufficient NGN balance', status: 400 });
      }

      // Deduct balance (Locking)
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      });

      // Create Pending Transaction record
      return tx.transaction.create({
        data: {
          userId,
          type: 'WITHDRAWAL',
          status: 'PENDING',
          amount,
          currency: 'NGN',
          reference: `FWD-${Date.now()}`,
          note: narration || `Withdrawal to ${targetBank.bankName} (${targetBank.accountNumber})`,
          metadata: JSON.stringify({ 
            bankDetailId, 
            bankName: targetBank.bankName, 
            accountNumber: targetBank.accountNumber,
            bankCode: targetBank.bankCode,
            accountName: targetBank.accountName,
          }),
        },
      });
    });

    try {
      // 3. Create Transfer Recipient on Paystack
      this.logger.log(`📡 Creating Paystack recipient for withdrawal ${transaction.id}`);
      const recipientResponse = await this.paystack.createTransferRecipient({
        name: targetBank.accountName,
        account_number: targetBank.accountNumber,
        bank_code: targetBank.bankCode,
      });

      const recipientCode = recipientResponse.data.recipient_code;

      // 4. Initiate Transfer via Paystack
      this.logger.log(`💸 Calling Paystack to initiate transfer for withdrawal ${transaction.id}`);
      const transferResponse = await this.paystack.initiateTransfer({
        amount,
        recipient: recipientCode,
        reference: transaction.reference,
        reason: narration || 'XBanka Fiat Withdrawal',
      });

      const providerData = transferResponse.data || transferResponse;

      // 5. Update Transaction status based on initial response
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED', // Simplified for demo; should ideally be PENDING until webhook
          reference: providerData.reference || transaction.reference,
        },
      });

      this.logger.log(`✅ Fiat Withdrawal initiated: ${transaction.id}`);
      return transaction;

    } catch (error) {
      this.logger.error(`❌ Fiat Withdrawal FAILED: ${error.message}`);

      // 6. Automatic Refund on Failure
      await this.prisma.$transaction([
        this.prisma.wallet.update({
          where: { userId_currency: { userId, currency: 'NGN' } },
          data: { balance: { increment: amount } },
        }),
        this.prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'FAILED',
            note: (transaction.note || '') + ` (Error: ${error.message})`,
          },
        }),
      ]);

      throw new RpcException({ message: `Fiat withdrawal failed: ${error.message}`, status: 500 });
    }
  }
}
