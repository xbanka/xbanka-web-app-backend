import { NestFactory } from '@nestjs/core';
import { WalletServiceModule } from '../apps/wallet-service/src/wallet-service.module';
import { WalletServiceService } from '../apps/wallet-service/src/wallet-service.service';

async function bootstrap() {
  console.log('🚀 Starting manual seed for market prices...');
  const app = await NestFactory.createApplicationContext(WalletServiceModule);
  const service = app.get(WalletServiceService);

  try {
    const result = await service.updateMarketPrices();
    console.log('✅ Seed result:', result);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
  } finally {
    await app.close();
  }
}

bootstrap();
