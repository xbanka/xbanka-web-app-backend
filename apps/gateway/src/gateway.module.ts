import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { GoogleStrategy } from './google.strategy';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-key-change-me',
      signOptions: { expiresIn: '1d' },
    }),
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: { port: 3001 },
      },
      {
        name: 'USER_SERVICE',
        transport: Transport.TCP,
        options: { port: 3002 },
      },
      {
        name: 'KYC_SERVICE',
        transport: Transport.TCP,
        options: { port: 3003 },
      },
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.TCP,
        options: { port: 3004 },
      },
      {
        name: 'WALLET_SERVICE',
        transport: Transport.TCP,
        options: { port: 3005 },
      },
      {
        name: 'GIFT_CARD_SERVICE',
        transport: Transport.TCP,
        options: { port: 3006 },
      },
    ]),
  ],
  controllers: [GatewayController],
  providers: [GatewayService, GoogleStrategy, JwtStrategy],
})
export class GatewayModule { }
