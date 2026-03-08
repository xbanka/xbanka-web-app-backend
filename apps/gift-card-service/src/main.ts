import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { GiftCardServiceModule } from './gift-card-service.module';

async function bootstrap() {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
        GiftCardServiceModule,
        {
            transport: Transport.TCP,
            options: {
                host: '0.0.0.0',
                port: 3006,
            },
        },
    );
    await app.listen();
    console.log('🚀 Gift Card Service is listening on port 3006');
}
bootstrap();
