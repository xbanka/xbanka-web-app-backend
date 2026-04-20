import { Controller, Post, Get, Body, Inject, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { InternalApiKeyGuard } from './internal-api-key.guard';
import { RateCalculatorDto, RateCalculatorResponseDto } from './dto/gateway.dto';

@ApiTags('internal')
@Controller('internal')
@UseGuards(InternalApiKeyGuard)
export class InternalController {
  constructor(
    @Inject('WALLET_SERVICE') private readonly walletClient: ClientProxy,
  ) { }

  @ApiOperation({ 
    summary: 'Internal rate calculator', 
    description: 'Requires x-internal-key header. Fetches exchange rates and estimated payouts with admin fees.' 
  })
  @ApiHeader({
    name: 'x-internal-key',
    description: 'Internal API Key for authentication',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Calculation result', type: RateCalculatorResponseDto })
  @Post('wallet/rate-calculator')
  async rateCalculator(@Body() data: RateCalculatorDto) {
    return this.walletClient.send({ cmd: 'check-rate' }, {
      source: data.sourceCurrency,
      target: data.targetCurrency,
      amount: data.amount,
      action: data.action,
    });
  }

  @ApiHeader({
    name: 'x-internal-key',
    description: 'Internal API Key for authentication',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'List of currencies' })
  @Get('wallet/currencies')
  async getCurrencies() {
    return this.walletClient.send({ cmd: 'get-currencies' }, {});
  }

  @ApiOperation({ 
    summary: 'Manual market price sync', 
    description: 'Requires x-internal-key header. Triggers an immediate fetch and update of crypto market prices from CoinCap.' 
  })
  @ApiHeader({
    name: 'x-internal-key',
    description: 'Internal API Key for authentication',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Sync initiated' })
  @Post('wallet/sync-market-prices')
  async syncMarketPrices() {
    return this.walletClient.send({ cmd: 'sync-market-prices' }, {});
  }
}
