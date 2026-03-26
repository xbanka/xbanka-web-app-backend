import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { WalletServiceService } from './wallet-service.service';

@Controller()
export class WalletServiceController {
  constructor(private readonly walletService: WalletServiceService) { }

  @MessagePattern({ cmd: 'get-wallets' })
  async handleGetWallets(@Payload() data: { userId: string }) {
    return this.walletService.getWallets(data.userId);
  }

  @MessagePattern({ cmd: 'get-wallet' })
  async handleGetWallet(@Payload() data: { userId: string; walletId: string }) {
    return this.walletService.getWallet(data.userId, data.walletId);
  }

  @MessagePattern({ cmd: 'get-crypto-wallets' })
  async handleGetCryptoWallets(@Payload() data: { userId: string }) {
    return this.walletService.getCryptoWallets(data.userId);
  }

  @MessagePattern({ cmd: 'get-fiat-wallets' })
  async handleGetFiatWallets(@Payload() data: { userId: string }) {
    return this.walletService.getFiatWallets(data.userId);
  }

  @MessagePattern({ cmd: 'generate-wallet-address' })
  async handleGenerateWalletAddress(@Payload() data: { userId: string; currency: string; network: string }) {
    return this.walletService.getOrCreateCryptoDepositAddress(data.userId, data.currency, data.network);
  }

  @MessagePattern({ cmd: 'add-bank-detail' })
  async handleAddBankDetail(@Payload() data: { userId: string; bankName: string; accountNumber: string; accountName: string }) {
    return this.walletService.addBankDetail(data.userId, data);
  }

  @MessagePattern({ cmd: 'convert-quote' })
  async handleConvertQuote(@Payload() data: { userId: string; sourceCurrency: string; targetCurrency: string; amount: number }) {
    return this.walletService.getConversionQuote(data.userId, data.sourceCurrency, data.targetCurrency, data.amount);
  }

  @MessagePattern({ cmd: 'convert-execute' })
  async handleConvertExecute(@Payload() data: { userId: string; quoteId: string; sourceCurrency: string; targetCurrency: string; amount: number }) {
    return this.walletService.executeConversion(data.userId, data.quoteId, data.sourceCurrency, data.targetCurrency, data.amount);
  }

  @MessagePattern({ cmd: 'get-bank-details' })
  async handleGetBankDetails(@Payload() data: { userId: string }) {
    return this.walletService.getBankDetails(data.userId);
  }

  @MessagePattern({ cmd: 'get-transactions' })
  async handleGetTransactions(@Payload() data: { userId: string; page?: number; limit?: number; category?: string }) {
    return this.walletService.getTransactions(data.userId, data.page, data.limit, data.category);
  }

  @MessagePattern({ cmd: 'handle-crypto-webhook' })
  async handleCryptoWebhook(@Payload() data: { payload: any; signature: string }) {
    return this.walletService.handleCryptoWebhook(data.payload, data.signature);
  }

  @MessagePattern({ cmd: 'handle-fiat-webhook' })
  async handleFiatWebhook(@Payload() data: { payload: any; signature: string; provider: string }) {
    return this.walletService.handleFiatWebhook(data.payload, data.signature, data.provider);
  }

  @MessagePattern({ cmd: 'get-banks-for-account' })
  async handleGetBanksForAccount(@Payload() data: { accountNumber: string }) {
    return this.walletService.getBanksForAccount(data.accountNumber);
  }

  @MessagePattern({ cmd: 'generate-nuban' })
  async handleGenerateNuban(@Payload() data: { bankCode: string; serialNumber: string }) {
    return this.walletService.generateNuban(data.bankCode, data.serialNumber);
  }

  @MessagePattern({ cmd: 'resolve-account-name' })
  async handleResolveAccountName(@Payload() data: { accountNumber: string; bankCode?: string }) {
    return this.walletService.resolveAccountName(data.accountNumber, data.bankCode);
  }

  @MessagePattern({ cmd: 'get-possible-banks' })
  async handleGetPossibleBanks(@Payload() data: { accountNumber: string }) {
    return this.walletService.getPossibleBanks(data.accountNumber);
  }

  @MessagePattern({ cmd: 'get-all-banks' })
  async handleGetAllBanks() {
    return this.walletService.getAllBanks();
  }

  @MessagePattern({ cmd: 'withdraw-crypto' })
  async handleWithdrawCrypto(@Payload() data: { userId: string; currency: string; network: string; address: string; amount: number; memo?: string; narration?: string }) {
    return this.walletService.withdrawCrypto(data.userId, data);
  }
}
