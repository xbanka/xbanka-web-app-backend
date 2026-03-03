import { Controller, Post, Body, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SignupDto, VerifyBvnDto, ApiResponseDto } from './dto/gateway.dto';

@Controller()
export class GatewayController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    @Inject('KYC_SERVICE') private readonly kycClient: ClientProxy,
  ) { }

  @ApiTags('auth')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, type: ApiResponseDto })
  @Post('auth/signup')
  signup(@Body() data: SignupDto) {
    return this.authClient.send({ cmd: 'signup' }, data);
  }

  @ApiTags('kyc')
  @ApiOperation({ summary: 'Verify user BVN' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @Post('kyc/verify-bvn')
  verifyBvn(@Body() data: VerifyBvnDto) {
    return this.kycClient.send({ cmd: 'verify-bvn' }, data);
  }
}
