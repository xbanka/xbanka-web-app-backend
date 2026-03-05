import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { GatewayModule } from './gateway.module';
import { ApiResponseInterceptor, ApiExceptionFilter } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);

  // Global Validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Standardize Response Format
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('XBanka API Gateway')
    .setDescription('The core API gateway for XBanka crypto and gift card trading platform.')
    .setVersion('1.0')
    .addTag('auth')
    .addTag('kyc')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3010);
}
bootstrap();
