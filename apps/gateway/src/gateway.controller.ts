import { Controller, Post, Body, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SignupDto, LoginDto, UpdateProfileDto, UpdateIdentityDto, UpdateSelfieDto, UpdateAddressDto, SkipStepDto, VerifyBvnDto, VerifyEmailDto, ApiResponseDto } from './dto/gateway.dto';

@Controller()
export class GatewayController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
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

  @ApiTags('auth')
  @ApiOperation({
    summary: 'Authenticate user',
    description: 'Validates user credentials and returns a JWT access token.'
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully authenticated',
    type: ApiResponseDto
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @Post('auth/login')
  login(@Body() data: LoginDto) {
    return this.authClient.send({ cmd: 'login' }, data);
  }

  @ApiTags('profile')
  @ApiOperation({
    summary: 'Update basic user profile information',
    description: 'Updates names, DOB, phone, gender, and country. Moves onboarding to the BVN stage.'
  })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @Post('users/profile')
  updateProfile(@Body() data: UpdateProfileDto) {
    return this.userClient.send({ cmd: 'update-profile' }, data);
  }

  @ApiTags('profile')
  @ApiOperation({
    summary: 'Skip the current onboarding step',
    description: 'Increments the currentStep for the user without requiring data submission.'
  })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @Post('users/skip-step')
  skipStep(@Body() data: SkipStepDto) {
    return this.userClient.send({ cmd: 'skip-step' }, data);
  }

  @ApiTags('kyc')
  @ApiOperation({
    summary: 'Submit identity document details',
    description: 'Saves ID type, number, and image URL. Moves onboarding to the SELFIE stage.'
  })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @Post('kyc/identity')
  updateIdentity(@Body() data: UpdateIdentityDto) {
    return this.kycClient.send({ cmd: 'update-identity' }, data);
  }

  @ApiTags('kyc')
  @ApiOperation({
    summary: 'Submit selfie verification',
    description: 'Saves the selfie image URL and moves onboarding to the ADDRESS stage.'
  })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @Post('kyc/selfie')
  updateSelfie(@Body() data: UpdateSelfieDto) {
    return this.kycClient.send({ cmd: 'update-selfie' }, data);
  }

  @ApiTags('kyc')
  @ApiOperation({
    summary: 'Submit residential address details',
    description: 'Saves address and proof of residency. Completes the onboarding process.'
  })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @Post('kyc/address')
  updateAddress(@Body() data: UpdateAddressDto) {
    return this.kycClient.send({ cmd: 'update-address' }, data);
  }

  @ApiTags('kyc')
  @ApiOperation({
    summary: 'Verify Bank Verification Number (BVN)',
    description: 'Integrates with IdentityPass to verify the provided BVN. Moves onboarding to the IDENTITY stage upon success.'
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
