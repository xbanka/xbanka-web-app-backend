import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { WalletServiceService } from './wallet-service.service';

@Controller()
export class WalletServiceController {
  constructor(private readonly walletService: WalletServiceService) { }

  @MessagePattern('get_wallets')
  async handleGetWallets(@Payload() data: { userId: string }) {
    return this.walletService.getWallets(data.userId);
  }

  @MessagePattern('add_bank_detail')
  async handleAddBankDetail(@Payload() data: { userId: string; bankName: string; accountNumber: string; accountName: string }) {
    return this.walletService.addBankDetail(data.userId, data);
  }

  @MessagePattern('get_bank_details')
  async handleGetBankDetails(@Payload() data: { userId: string }) {
    return this.walletService.getBankDetails(data.userId);
  }

  @MessagePattern('get_transactions')
  async handleGetTransactions(@Payload() data: { userId: string; page?: number; limit?: number }) {
    return this.walletService.getTransactions(data.userId, data.page, data.limit);
  }
}
