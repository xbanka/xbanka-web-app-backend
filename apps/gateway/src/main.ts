import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { GatewayModule } from './gateway.module';
import { ApiResponseInterceptor, ApiExceptionFilter } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);

  app.use(cookieParser());
  app.use(require('express').json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf.toString();
    },
    limit: '10mb'
  }));

  // Enable CORS
  app.enableCors({
    origin: ['http://localhost:3000','https://app.xbankang.com'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

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
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3010);
}
bootstrap();
