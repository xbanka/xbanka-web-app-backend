import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NotificationServiceModule } from './notification-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NotificationServiceModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: 3004,
      },
    },
  );
  await app.listen();
  console.log('🚀 Notification Service is listening on port 3004');
}
bootstrap();
