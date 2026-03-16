import { Controller, Get, Post, Body, Inject, Req, Res, UseGuards, Query, Sse, MessageEvent, UseInterceptors, UploadedFile, Param, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Observable, map, firstValueFrom } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GoogleAuthGuard } from './google-auth.guard';
import { PaginationQueryDto, WalletResponseDto, BankDetailDto, BankDetailResponseDto, TransactionResponseDto, PaginatedResponseDto, SignupDto, LoginDto, UpdateProfileDto, UpdateIdentityDto, UpdateSelfieDto, UpdateAddressDto, SkipStepDto, VerifyBvnDto, VerifyEmailDto, ApiResponseDto, GiftCardDto, SellGiftCardDto, TradingOverviewDto, PayoutTrendDto, GiftCardCategoryDto, GiftCardRegionDto, ResendVerificationDto, GenerateNubanDto, AccountLookupDto } from './dto/gateway.dto';
import { S3Service } from '@app/common';

@Controller()
export class GatewayController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    @Inject('KYC_SERVICE') private readonly kycClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
    @Inject('WALLET_SERVICE') private readonly walletClient: ClientProxy,
    @Inject('GIFT_CARD_SERVICE') private readonly giftCardClient: ClientProxy,
    private readonly s3Service: S3Service,
  ) { }

  @Post('test-notification')
  async testNotification(@Body() data: { to: string; type: 'email' | 'sms'; message: string }) {
    const pattern = data.type === 'email' ? 'send_email' : 'send_sms';
    const payload = data.type === 'email'
      ? { to: data.to, subject: 'Test Notification', body: data.message }
      : { to: data.to, message: data.message };

    return this.notificationClient.send(pattern, payload);
  }

  @ApiTags('webhooks')
  @ApiOperation({ summary: 'Obiex crypto webhook handler', description: 'Public endpoint for Obiex to send crypto deposit/transaction confirmation webhooks.' })
  @Post('webhooks/crypto/obiex')
  async handleObiexWebhook(@Req() req, @Body() payload: any) {
    const signature = req.headers['x-obiex-signature'];
    return this.walletClient.send({ cmd: 'handle-crypto-webhook' }, { payload, signature });
  }

  @ApiTags('webhooks')
  @ApiOperation({ summary: 'Fiat webhook handler', description: 'Public endpoint to handle fiat transaction notifications from providers like Flutterwave or Paystack.' })
  @Post('webhooks/fiat/:provider')
  async handleFiatWebhook(@Req() req, @Body() payload: any) {
    const provider = req.params.provider;
    const signature = req.headers['x-webhook-signature'] || req.headers['verif-hash']; // Handle common signature headers
    return this.walletClient.send({ cmd: 'handle-fiat-webhook' }, { payload, signature, provider });
  }

  @ApiTags('nuban')
  @ApiOperation({ summary: 'List all supported Nigerian banks', description: 'Returns a list of all Nigerian banks and their CBN codes for selection.' })
  @Get('accounts/banks')
  async getAllBanks() {
    return this.walletClient.send({ cmd: 'get-all-banks' }, {});
  }

  @ApiTags('nuban')
  @ApiOperation({ summary: 'Resolve account name', description: 'Looks up the account name for a given account number. If bankCode is provided, lookup is faster. If not, it attempts an account-only lookup.' })
  @ApiBody({ type: AccountLookupDto })
  @Post('accounts/lookup')
  async resolveAccountName(@Body() data: AccountLookupDto) {
    try {
      return await firstValueFrom(this.walletClient.send({ cmd: 'resolve-account-name' }, { ...data }));
    } catch (error) {
      throw new BadRequestException(error.message || 'Account lookup failed');
    }
  }


  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get all wallets for the authenticated user', description: 'Returns a list of all active wallets (NGN, USDT, BTC) and their current balances.' })
  @ApiResponse({ status: 200, description: 'List of wallets', type: [WalletResponseDto] })
  @Get('wallets')
  async getWallets(@Req() req) {
    return this.walletClient.send({ cmd: 'get-wallets' }, { userId: req.user.id });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get a single wallet by ID', description: 'Returns a specific wallet with all its provider addresses.' })
  @ApiResponse({ status: 200, description: 'Wallet details' })
  @Get('wallets/:walletId')
  async getWallet(@Req() req, @Query('walletId') walletId: string) {
    return this.walletClient.send({ cmd: 'get-wallet' }, { userId: req.user.id, walletId });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get crypto wallets with NGN equivalent', description: 'Returns all CRYPTO wallets with live NGN fiat equivalent for each balance.' })
  @ApiResponse({ status: 200, description: 'Crypto wallets with fiat equivalent' })
  @Get('wallets/crypto')
  async getCryptoWallets(@Req() req) {
    return this.walletClient.send({ cmd: 'get-crypto-wallets' }, { userId: req.user.id });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get fiat wallets', description: 'Returns all FIAT wallets and their linked accounts.' })
  @ApiResponse({ status: 200, description: 'Fiat wallets' })
  @Get('wallets/fiat')
  async getFiatWallets(@Req() req) {
    return this.walletClient.send({ cmd: 'get-fiat-wallets' }, { userId: req.user.id });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Generate or retrieve a crypto deposit address', description: 'Gets an existing deposit address or creates a new one via Obiex for the given currency and network.' })
  @ApiResponse({ status: 200, description: 'Deposit address' })
  @Post('wallets/deposit/crypto')
  async generateWalletAddress(@Req() req, @Body() data: { currency: string; network: string }) {
    return this.walletClient.send({ cmd: 'generate-wallet-address' }, { userId: req.user.id, ...data });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Add a new bank account', description: 'Links a new bank account to the user\'s profile for withdrawals.' })
  @ApiResponse({ status: 201, description: 'Bank account added successfully', type: BankDetailResponseDto })
  @Post('wallet/banks')
  async addBankDetail(@Req() req, @Body() data: BankDetailDto) {
    return this.walletClient.send({ cmd: 'add-bank-detail' }, { userId: req.user.id, ...data });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get linked bank accounts', description: 'Returns all bank accounts currently linked to the user\'s profile.' })
  @ApiResponse({ status: 200, description: 'List of bank accounts', type: [BankDetailResponseDto] })
  @Get('wallet/banks')
  async getBankDetails(@Req() req) {
    return this.walletClient.send({ cmd: 'get-bank-details' }, { userId: req.user.id });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get transaction history', description: 'Returns a paginated list of all deposits, withdrawals, and transfers.' })
  @ApiResponse({ status: 200, description: 'Paginated transactions', type: PaginatedResponseDto })
  @ApiQuery({ type: PaginationQueryDto })
  @Get('wallet/transactions')
  async getTransactions(@Req() req, @Query() pagination: PaginationQueryDto) {
    return this.walletClient.send({ cmd: 'get-transactions' }, {
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
    return this.authClient.send({ cmd: 'verify-email' }, { token: data.token });
  }

  @ApiTags('auth')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @Post('auth/login')
  async login(@Body() data: LoginDto, @Req() req: any) {
    const metadata = {
      deviceId: req.headers['x-device-id'],
      deviceName: req.headers['x-device-name'],
      deviceType: req.headers['x-device-type'],
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
    return this.authClient.send({ cmd: 'login' }, { ...data, metadata });
  }

  @ApiTags('auth')
  @ApiOperation({
    summary: 'Resend email verification token',
    description: 'Generates a new verification token and sends it to the user\'s email.',
  })
  @ApiResponse({ status: 200, description: 'Verification email resent', type: ApiResponseDto })
  @Post('auth/resend-verification')
  resendVerification(@Body() data: ResendVerificationDto) {
    return this.authClient.send({ cmd: 'resend-verification' }, data);
  }

  @ApiTags('auth')
  @ApiOperation({
    summary: 'Initiate Google Sign-In',
    description: 'Redirects the user to the Google OAuth2 consent screen. Direct the user\'s browser to this URL to begin the Google login flow.'
  })
  @Get('auth/google')
  @UseGuards(GoogleAuthGuard)
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
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: any, @Res() res: any) {
    const result = await this.authClient.send({ cmd: 'google-login' }, req.user).toPromise();
    // Retrieve the original redirect url from the state query parameter
    const redirectUrlStr = req.query.state || (process.env.FRONTEND_URL || 'http://localhost:3001') + '/auth/callback';

    try {
      const redirectUrl = new URL(redirectUrlStr);
      // Append token to the URL, handling existing query parameters safely
      redirectUrl.searchParams.append('token', result.access_token);
      res.redirect(redirectUrl.toString());
    } catch (e) {
      // Fallback in case state is somehow an invalid URL
      res.redirect(`${redirectUrlStr}?token=${result.access_token}`);
    }
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
    description: 'Saves ID type, number, and uploads image to S3. Moves onboarding to the SELFIE stage.'
  })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @Post('kyc/identity')
  @UseInterceptors(FileInterceptor('idImage'))
  async updateIdentity(
    @Body() data: UpdateIdentityDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    let idImageUrl = '';
    if (file) {
      idImageUrl = await this.s3Service.uploadFile(file, 'identity');
    }
    return this.kycClient.send({ cmd: 'update-identity' }, { ...data, idImageUrl });
  }

  @ApiTags('kyc')
  @ApiOperation({
    summary: 'Submit selfie verification',
    description: 'Uploads selfie image to S3 and moves onboarding to the ADDRESS stage.'
  })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @Post('kyc/selfie')
  @UseInterceptors(FileInterceptor('selfieImage'))
  async updateSelfie(
    @Body() data: UpdateSelfieDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    let selfieUrl = '';
    if (file) {
      selfieUrl = await this.s3Service.uploadFile(file, 'selfie');
    }
    return this.kycClient.send({ cmd: 'update-selfie' }, { ...data, selfieUrl });
  }

  @ApiTags('kyc')
  @ApiOperation({
    summary: 'Submit residential address details',
    description: 'Saves address and uploads proof of residency to S3. Completes the onboarding process.'
  })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @Post('kyc/address')
  @UseInterceptors(FileInterceptor('proofOfAddressImage'))
  async updateAddress(
    @Body() data: UpdateAddressDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    let proofOfAddress = '';
    if (file) {
      proofOfAddress = await this.s3Service.uploadFile(file, 'address');
    }
    return this.kycClient.send({ cmd: 'update-address' }, { ...data, proofOfAddress });
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

  @ApiTags('gift-cards')
  @ApiOperation({ summary: 'Get available gift cards', description: 'Returns a list of all gift cards currently available for trading.' })
  @ApiResponse({ status: 200, type: [GiftCardDto] })
  @Get('gift-cards')
  getGiftCards() {
    return this.giftCardClient.send('get_gift_cards', {});
  }

  @ApiTags('gift-cards')
  @ApiOperation({ summary: 'Get gift card categories', description: 'Returns all active gift card categories (e.g., Physical, Ecode).' })
  @ApiResponse({ status: 200, type: [GiftCardCategoryDto] })
  @Get('gift-cards/categories')
  getCategories() {
    return this.giftCardClient.send('get_categories', {});
  }

  @ApiTags('gift-cards')
  @ApiOperation({ summary: 'Get gift card regions', description: 'Returns all active gift card regions (e.g., USA, UK).' })
  @ApiResponse({ status: 200, type: [GiftCardRegionDto] })
  @Get('gift-cards/regions')
  getRegions() {
    return this.giftCardClient.send('get_regions', {});
  }

  @ApiTags('gift-cards')
  @ApiOperation({ summary: 'Live gift card rates stream', description: 'Server-Sent Events stream for real-time gift card rate updates.' })
  @Sse('gift-cards/stream')
  streamGiftCardRates(): Observable<MessageEvent> {
    return this.giftCardClient.send('get_rate_updates', {}).pipe(
      map((data) => ({ data } as MessageEvent)),
    );
  }

  @ApiTags('gift-cards')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Sell a gift card', description: 'Initiates a trade to sell a gift card. Requires user authentication.' })
  @ApiResponse({ status: 201, description: 'Trade initiated successfully' })
  @Post('gift-cards/sell')
  sellGiftCard(@Req() req, @Body() data: SellGiftCardDto) {
    return this.giftCardClient.send('sell_gift_card', { userId: req.user.id, payload: data });
  }

  @ApiTags('dashboard')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get dashboard overview statistics', description: 'Returns aggregated trading stats for the authenticated user.' })
  @ApiResponse({ status: 200, type: TradingOverviewDto })
  @Get('dashboard/overview')
  getDashboardOverview(@Req() req) {
    return this.giftCardClient.send('get_trading_overview', { userId: req.user.id });
  }

  @ApiTags('dashboard')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get payout trend for charts', description: 'Returns time-series payout data for dashboard charts.' })
  @ApiResponse({ status: 200, type: [PayoutTrendDto] })
  @Get('dashboard/payout-trend')
  getPayoutTrend(@Req() req) {
    return this.giftCardClient.send('get_payout_trend', { userId: req.user.id });
  }

  @ApiTags('auth')
  @Post('auth/verify-device')
  verifyDevice(@Body() data: { userId: string; deviceId: string; code: string }) {
    return this.authClient.send({ cmd: 'verify-device' }, data);
  }

  @ApiTags('security')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('security/sessions')
  getSessions(@Req() req: any) {
    return this.authClient.send({ cmd: 'get-sessions' }, req.user.userId);
  }

  @ApiTags('security')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('security/sessions/revoke')
  revokeSession(@Body() data: { sessionId: string }, @Req() req: any) {
    return this.authClient.send({ cmd: 'revoke-session' }, { sessionId: data.sessionId, userId: req.user.userId });
  }

  @ApiTags('security')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('security/devices')
  getDevices(@Req() req: any) {
    return this.authClient.send({ cmd: 'get-devices' }, req.user.userId);
  }

  @ApiTags('security')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('security/devices/remove')
  removeDevice(@Body() data: { deviceId: string }, @Req() req: any) {
    return this.authClient.send({ cmd: 'remove-device' }, { deviceId: data.deviceId, userId: req.user.userId });
  }
}
