import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AuthServiceModule } from './auth-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AuthServiceModule,
    {
      transport: Transport.TCP,
      options: { port: 3001 },
    },
  );
  await app.listen();
}
bootstrap();
