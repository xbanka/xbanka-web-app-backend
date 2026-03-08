import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { WalletServiceModule } from './wallet-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    WalletServiceModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: 3005,
      },
    },
  );
  await app.listen();
  console.log('🚀 Wallet Service is listening on port 3005');
}
bootstrap();
