import { Controller, Get, Post, Body, Inject, Req, Res, UseGuards, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PaginationQueryDto, WalletResponseDto, BankDetailDto, BankDetailResponseDto, TransactionResponseDto, PaginatedResponseDto, SignupDto, LoginDto, UpdateProfileDto, UpdateIdentityDto, UpdateSelfieDto, UpdateAddressDto, SkipStepDto, VerifyBvnDto, VerifyEmailDto, ApiResponseDto } from './dto/gateway.dto';

@Controller()
export class GatewayController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    @Inject('KYC_SERVICE') private readonly kycClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
    @Inject('WALLET_SERVICE') private readonly walletClient: ClientProxy,
  ) { }

  @Post('test-notification')
  async testNotification(@Body() data: { to: string; type: 'email' | 'sms'; message: string }) {
    const pattern = data.type === 'email' ? 'send_email' : 'send_sms';
    const payload = data.type === 'email'
      ? { to: data.to, subject: 'Test Notification', body: data.message }
      : { to: data.to, message: data.message };

    return this.notificationClient.send(pattern, payload);
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get all wallets for the authenticated user', description: 'Returns a list of all active wallets (NGN, USDT, BTC) and their current balances.' })
  @ApiResponse({ status: 200, description: 'List of wallets', type: [WalletResponseDto] })
  @Get('wallets')
  async getWallets(@Req() req) {
    return this.walletClient.send('get_wallets', { userId: req.user.id });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Add a new bank account', description: 'Links a new bank account to the user\'s profile for withdrawals.' })
  @ApiResponse({ status: 201, description: 'Bank account added successfully', type: BankDetailResponseDto })
  @Post('wallet/banks')
  async addBankDetail(@Req() req, @Body() data: BankDetailDto) {
    return this.walletClient.send('add_bank_detail', { userId: req.user.id, ...data });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get linked bank accounts', description: 'Returns all bank accounts currently linked to the user\'s profile.' })
  @ApiResponse({ status: 200, description: 'List of bank accounts', type: [BankDetailResponseDto] })
  @Get('wallet/banks')
  async getBankDetails(@Req() req) {
    return this.walletClient.send('get_bank_details', { userId: req.user.id });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get transaction history', description: 'Returns a paginated list of all deposits, withdrawals, and transfers.' })
  @ApiResponse({ status: 200, description: 'Paginated transactions', type: PaginatedResponseDto })
  @ApiQuery({ type: PaginationQueryDto })
  @Get('wallet/transactions')
  async getTransactions(@Req() req, @Query() pagination: PaginationQueryDto) {
    return this.walletClient.send('get_transactions', {
      userId: req.user.id,
      page: parseInt(pagination.page || '1'),
      limit: parseInt(pagination.limit || '10'),
    });
  }

  @ApiTags('auth')
  @ApiOperation({
    summary: 'Register a new user account',
    description: 'Creates a new user account with hashed password. Initializes the onboarding process at the SIGNUP stage.'
  })
  @ApiResponse({ status: 201, description: 'User successfully created', type: ApiResponseDto })
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
  @ApiResponse({ status: 200, description: 'Email successfully verified', type: ApiResponseDto })
  @Post('auth/verify-email')
  verifyEmail(@Body() data: VerifyEmailDto) {
    return this.authClient.send({ cmd: 'verify-email' }, data);
  }

  @ApiTags('auth')
  @ApiOperation({
    summary: 'Authenticate user',
    description: 'Validates user credentials and returns a JWT access token.'
  })
  @ApiResponse({ status: 200, description: 'Successfully authenticated', type: ApiResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @Post('auth/login')
  login(@Body() data: LoginDto) {
    return this.authClient.send({ cmd: 'login' }, data);
  }

  @ApiTags('auth')
  @ApiOperation({
    summary: 'Initiate Google Sign-In',
    description: 'Redirects the user to the Google OAuth2 consent screen. Direct the user\'s browser to this URL to begin the Google login flow.'
  })
  @Get('auth/google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Passport redirects to Google automatically — no body needed
  }

  @ApiTags('auth')
  @ApiOperation({
    summary: 'Google Sign-In Callback',
    description: 'Google redirects here after login. The backend verifies the user, creates an account if needed, and redirects the client to the frontend with a JWT token.'
  })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with access_token in query params' })
  @Get('auth/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: any, @Res() res: any) {
    const result = await this.authClient.send({ cmd: 'google-login' }, req.user).toPromise();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/auth/callback?token=${result.access_token}`);
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
  @ApiResponse({ status: 200, description: 'BVN successfully verified', type: ApiResponseDto })
  @Post('kyc/verify-bvn')
  verifyBvn(@Body() data: VerifyBvnDto) {
    return this.kycClient.send({ cmd: 'verify-bvn' }, data);
  }
}
