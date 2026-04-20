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
  async handleConvertQuote(@Payload() data: { userId: string; sourceCurrency: string; targetCurrency: string; amount: number; action?: string }) {
    return this.walletService.getConversionQuote(data.userId, data.sourceCurrency, data.targetCurrency, data.amount, data.action);
  }

  @MessagePattern({ cmd: 'check-rate' })
  async handleCheckRate(@Payload() data: { source: string; target: string; amount: number; action?: string }) {
    return this.walletService.calculateRate(data);
  }

  @MessagePattern({ cmd: 'get-currencies' })
  async handleGetCurrencies() {
    return this.walletService.getCurrencies();
  }

  @MessagePattern({ cmd: 'get-grouped-pairs' })
  async handleGetGroupedPairs() {
    return this.walletService.getGroupedPairs();
  }

  @MessagePattern({ cmd: 'get-pairs' })
  async handleGetPairs() {
    return this.walletService.getPairs();
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

  @MessagePattern({ cmd: 'initiate-fiat-deposit' })
  async handleInitiateFiatDeposit(@Payload() data: { userId: string; amount: number; callback_url?: string; saveCard?: boolean }) {
    return this.walletService.initiateFiatDeposit(data.userId, data.amount, data.callback_url, data.saveCard);
  }

  @MessagePattern({ cmd: 'verify-fiat-deposit' })
  async handleVerifyFiatDeposit(@Payload() data: { reference: string }) {
    return this.walletService.verifyFiatDeposit(data.reference);
  }

  @MessagePattern({ cmd: 'initiate-direct-debit' })
  async handleInitiateDirectDebit(@Payload() data: { userId: string; callback_url?: string; accountNumber?: string; bankCode?: string }) {
    return this.walletService.initiateDirectDebit(data.userId, data.callback_url, data.accountNumber, data.bankCode);
  }

  @MessagePattern({ cmd: 'verify-direct-debit' })
  async handleVerifyDirectDebit(@Payload() data: { reference: string }) {
    return this.walletService.verifyDirectDebit(data.reference);
  }

  @MessagePattern({ cmd: 'charge-direct-debit' })
  async handleChargeDirectDebit(@Payload() data: { userId: string; mandateId: string; amount: number }) {
    return this.walletService.chargeDirectDebit(data.userId, data.mandateId, data.amount);
  }

  @MessagePattern({ cmd: 'deactivate-direct-debit' })
  async handleDeactivateDirectDebit(@Payload() data: { userId: string; mandateId: string }) {
    return this.walletService.deactivateDirectDebit(data.userId, data.mandateId);
  }

  @MessagePattern({ cmd: 'handle-direct-debit-webhook' })
  async handleDirectDebitWebhook(@Payload() payload: any) {
    return this.walletService.handleDirectDebitWebhook(payload);
  }

  @MessagePattern({ cmd: 'get-saved-cards' })
  async handleGetSavedCards(@Payload() data: { userId: string }) {
    return this.walletService.getSavedCards(data.userId);
  }

  @MessagePattern({ cmd: 'charge-saved-card' })
  async handleChargeSavedCard(@Payload() data: { userId: string; savedCardId: string; amount: number }) {
    return this.walletService.chargeSavedCard(data.userId, data.savedCardId, data.amount);
  }

  @MessagePattern({ cmd: 'delete-saved-card' })
  async handleDeleteSavedCard(@Payload() data: { userId: string; cardId: string }) {
    return this.walletService.deleteSavedCard(data.userId, data.cardId);
  }

  @MessagePattern({ cmd: 'get-market-price-updates' })
  handleGetMarketPriceUpdates() {
    return this.walletService.getMarketPriceUpdates();
  }

  @MessagePattern({ cmd: 'get-latest-market-prices' })
  async handleGetLatestMarketPrices() {
    return this.walletService.getLatestMarketPrices();
  }

  @MessagePattern({ cmd: 'sync-market-prices' })
  async handleSyncMarketPrices() {
    return this.walletService.updateMarketPrices();
  }

  @MessagePattern({ cmd: 'get-direct-debit-banks' })
  async handleGetDirectDebitBanks() {
    return this.walletService.getDirectDebitBanks();
  }
}
