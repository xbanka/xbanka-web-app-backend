import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { KycServiceModule } from './kyc-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    KycServiceModule,
    {
      transport: Transport.TCP,
      options: { port: 3003 },
    },
  );
  await app.listen();
}
bootstrap();
