import { Controller, Post, Body, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SignupDto, VerifyBvnDto, VerifyEmailDto, ApiResponseDto } from './dto/gateway.dto';

@Controller()
export class GatewayController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    @Inject('KYC_SERVICE') private readonly kycClient: ClientProxy,
  ) { }

  @ApiTags('auth')
  @ApiOperation({
    summary: 'Register a new user account',
    description: 'Creates a new user account with hashed password. Initializes the onboarding process at the SIGNUP stage.'
  })
  @ApiResponse({
    status: 201,
    description: 'User successfully created',
    type: ApiResponseDto
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @Post('auth/signup')
  signup(@Body() data: SignupDto) {
    return this.authClient.send({ cmd: 'signup' }, data);
  }

  @ApiTags('auth')
  @ApiOperation({
    summary: 'Verify user email address',
    description: 'Validates the user\'s email and moves the onboarding process to the EMAIL_VERIFIED stage.'
  })
  @ApiResponse({
    status: 200,
    description: 'Email successfully verified',
    type: ApiResponseDto
  })
  @Post('auth/verify-email')
  verifyEmail(@Body() data: VerifyEmailDto) {
    return this.authClient.send({ cmd: 'verify-email' }, data);
  }

  @ApiTags('kyc')
  @ApiOperation({
    summary: 'Verify Bank Verification Number (BVN)',
    description: 'Integrates with IdentityPass to verify the provided BVN. Moves onboarding to the BVN stage upon success.'
  })
  @ApiResponse({
    status: 200,
    description: 'BVN successfully verified',
    type: ApiResponseDto
  })
  @Post('kyc/verify-bvn')
  verifyBvn(@Body() data: VerifyBvnDto) {
    return this.kycClient.send({ cmd: 'verify-bvn' }, data);
  }
}
