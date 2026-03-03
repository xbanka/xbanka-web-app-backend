import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
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
    ]),
  ],
  controllers: [GatewayController],
  providers: [GatewayService],
})
export class GatewayModule { }
