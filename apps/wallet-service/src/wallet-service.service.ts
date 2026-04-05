import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { DatabaseService } from '@app/database';
import { ObiexService, NubanService, NubanApiService } from '@app/common';
import { WalletType } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class WalletServiceService {
  private readonly logger = new Logger(WalletServiceService.name);

  constructor(
    private readonly prisma: DatabaseService,
    private readonly obiex: ObiexService,
    private readonly nuban: NubanService,
    private readonly nubanApi: NubanApiService,
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

    // 3. Calculate admin fee
    // Obiex returns amountReceived for the target amount
    const grossPayout = data.amountReceived || data.payout || data.amount;
    const fee = await this.calculateAdminFee(source, target, grossPayout || 0);
    const netPayout = (grossPayout || 0) - fee;

    // 4. Robust expiry parsing (Obiex uses expiryDate)
    const rawExpiry = data.expiryDate || data.expiresAt || data.expiry || data.expires_at;
    const expiresAt = rawExpiry ? new Date(rawExpiry) : new Date(Date.now() + 5 * 60 * 1000);

    // 5. Store quote internally for logging and to hide Obiex ID
    const quote = await this.prisma.conversionQuote.create({
      data: {
        userId,
        obiexQuoteId: data.id || data.quoteId,
        sourceCurrency: source,
        targetCurrency: target,
        sourceAmount: amount,
        rate: data.rate,
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
      rate: data.rate,
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

    // 2. Get live quote from Obiex
    const obiexQuote: any = await this.obiex.getExchangeRate(canonicalSource, canonicalTarget, data.amount, side);
    const quoteData = obiexQuote.data || obiexQuote;

    // 3. Calculate admin fee
    const grossPayout = quoteData.amountReceived || quoteData.payout || quoteData.amount;
    const fee = await this.calculateAdminFee(data.source, data.target, grossPayout || 0);
    const netPayout = (grossPayout || 0) - fee;

    return {
      sourceCurrency: data.source,
      targetCurrency: data.target,
      sourceAmount: data.amount,
      rate: quoteData.rate,
      grossPayout: grossPayout || 0,
      adminFee: fee,
      netPayout,
      estimatedPrice: `1 ${data.source} ≈ ${quoteData.rate.toLocaleString()} ${data.target}`,
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
}
