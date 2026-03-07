import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from './google.strategy';

@Module({
  imports: [
    PassportModule,
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
    ]),
  ],
  controllers: [GatewayController],
  providers: [GatewayService, GoogleStrategy],
})
export class GatewayModule { }
