import { Controller, Get, Post, Body, Inject, Req, Res, UseGuards, Query, Sse, MessageEvent, UseInterceptors, UploadedFile, Param, BadRequestException, Headers, Delete } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Observable, map, firstValueFrom } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GoogleAuthGuard } from './google-auth.guard';
import { PaginationQueryDto, WalletResponseDto, BankDetailDto, BankDetailResponseDto, TransactionResponseDto, PaginatedResponseDto, SignupDto, LoginDto, UpdateProfileDto, UpdateIdentityDto, UpdateSelfieDto, UpdateAddressDto, SkipStepDto, VerifyBvnDto, VerifyEmailDto, ApiResponseDto, GiftCardDto, SellGiftCardDto, TradingOverviewDto, PayoutTrendDto, GiftCardCategoryDto, GiftCardRegionDto, ResendVerificationDto, GenerateNubanDto, AccountLookupDto, LoginResponseDto, VerifyDeviceDto, ChangePasswordDto, CreatePinDto, UpdatePinDto, ValidatePinDto, Enable2faDto, Verify2faDto, RequestSecurityOtpDto, ConvertQuoteDto, ConvertExecuteDto, ConvertQuoteResponseDto, WithdrawCryptoDto, RateCalculatorDto, RateCalculatorResponseDto, InitiateFundingDto, FundingResponseDto, DirectDebitInitiateDto, DirectDebitChargeDto, DirectDebitDeactivateDto, ChargeSavedCardDto } from './dto/gateway.dto';
import { S3Service } from '@app/common';
import { PaystackWebhookGuard } from './guards/paystack-webhook.guard';

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
  @ApiOperation({ summary: 'Get a single wallet by ID', description: 'Returns a specific wallet with all its provider addresses.' })
  @ApiResponse({ status: 200, description: 'Wallet details' })
  @Get('wallets/:walletId')
  async getWallet(@Req() req, @Param('walletId') walletId: string) {
    return this.walletClient.send({ cmd: 'get-wallet' }, { userId: req.user.id, walletId });
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
  @ApiOperation({ summary: 'Calculate exchange rate (Rate Calculator)', description: 'Fetches the current exchange rate and estimated payout without creating a quote record.' })
  @ApiResponse({ status: 200, description: 'Rate calculation result', type: RateCalculatorResponseDto })
  @Post('wallets/convert/check-rate')
  async checkRate(@Req() req, @Body() data: RateCalculatorDto) {
    return this.walletClient.send({ cmd: 'check-rate' }, { ...data, source: data.sourceCurrency, target: data.targetCurrency });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get a conversion quote', description: 'Fetches a quote for converting between currencies, including administrative fees.' })
  @ApiResponse({ status: 200, description: 'Conversion quote', type: ConvertQuoteResponseDto })
  @Post('wallets/convert/quote')
  async getConvertQuote(@Req() req, @Body() data: ConvertQuoteDto) {
    return this.walletClient.send({ cmd: 'convert-quote' }, { userId: req.user.id, ...data });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Execute a currency conversion', description: 'Executes a conversion using a previously obtained quote ID. Deducts source and credits target wallet.' })
  @ApiResponse({ status: 200, description: 'Conversion successful', type: TransactionResponseDto })
  @Post('wallets/convert/execute')
  async executeConversion(@Req() req, @Body() data: ConvertExecuteDto) {
    return this.walletClient.send({ cmd: 'convert-execute' }, { userId: req.user.id, ...data });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Withdraw crypto to an external address', description: 'Checks address validity, locks funds, and executes withdrawal via Obiex.' })
  @ApiResponse({ status: 200, description: 'Withdrawal successful', type: TransactionResponseDto })
  @Post('wallets/withdraw/crypto')
  async withdrawCrypto(@Req() req, @Body() data: WithdrawCryptoDto) {
    return this.walletClient.send({ cmd: 'withdraw-crypto' }, { userId: req.user.id, ...data });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Initiate a fiat wallet deposit', description: 'Starts a fiat deposit via Paystack. Returns a checkout URL.' })
  @ApiResponse({ status: 200, description: 'Initialization successful', type: FundingResponseDto })
  @Post('wallets/fiat/fund/initiate')
  async initiateFiatDeposit(@Req() req, @Body() data: InitiateFundingDto) {
    return this.walletClient.send({ cmd: 'initiate-fiat-deposit' }, { userId: req.user.id, amount: data.amount, saveCard: data.saveCard });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Verify a fiat wallet deposit', description: 'Manually triggers a verification check for a Paystack transaction.' })
  @ApiResponse({ status: 200, description: 'Verification check complete' })
  @Get('wallets/fiat/fund/verify/:reference')
  async verifyFiatDeposit(@Param('reference') reference: string) {
    return this.walletClient.send({ cmd: 'verify-fiat-deposit' }, { reference });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get saved cards', description: 'Retrieve logic for users saved funding cards.' })
  @ApiResponse({ status: 200, description: 'User saved cards' })
  @Get('wallets/fiat/saved-cards')
  async getSavedCards(@Req() req) {
    return this.walletClient.send({ cmd: 'get-saved-cards' }, { userId: req.user.id });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Charge a saved card', description: 'Fund your fiat wallet using an already saved tokenized card.' })
  @ApiResponse({ status: 200, description: 'Charge processed successfully' })
  @Post('wallets/fiat/fund/saved-card')
  async chargeSavedCard(@Req() req, @Body() data: ChargeSavedCardDto) {
    return this.walletClient.send({ cmd: 'charge-saved-card' }, { userId: req.user.id, ...data });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Delete a saved card', description: 'Delete a previously saved card.' })
  @ApiResponse({ status: 200, description: 'Card deleted' })
  @Delete('wallets/fiat/saved-cards/:cardId')
  async deleteSavedCard(@Req() req, @Param('cardId') cardId: string) {
    return this.walletClient.send({ cmd: 'delete-saved-card' }, { userId: req.user.id, cardId });
  }


  @ApiTags('wallet')
  @ApiOperation({ summary: 'Paystack Webhook', description: 'Global webhook for Paystack payment notifications.' })
  @UseGuards(PaystackWebhookGuard)
  @Post('wallets/webhook/paystack')
  async paystackWebhook(@Body() data: any, @Headers('x-paystack-signature') signature: string) {
    if (data.event === 'charge.success') {
      const reference = data.data.reference;
      return this.walletClient.send({ cmd: 'verify-fiat-deposit' }, { reference });
    } else if (data.event === 'direct_debit.authorization.created' || data.event === 'direct_debit.authorization.active') {
      // Direct debit authorization payload, redirect to the new webhook handler in wallet.
      // Payload structure: { event: string, data: any }
      return this.walletClient.send({ cmd: 'handle-direct-debit-webhook' }, data);
    }
    return { status: 'handled' };
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Initiate Direct Debit Authorization', description: 'Initializes a Paystack direct debit mandate for the user.' })
  @ApiResponse({ status: 200, description: 'Initialization successful' })
  @Post('wallets/fiat/direct-debit/initiate')
  async initiateDirectDebit(@Req() req, @Body() data: DirectDebitInitiateDto) {
    return this.walletClient.send({ cmd: 'initiate-direct-debit' }, { userId: req.user.id, ...data });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Verify Direct Debit Authorization', description: 'Checks the status of the authorization.' })
  @ApiResponse({ status: 200, description: 'Verification successful' })
  @Get('wallets/fiat/direct-debit/verify/:reference')
  async verifyDirectDebit(@Req() req, @Param('reference') reference: string) {
    return this.walletClient.send({ cmd: 'verify-direct-debit' }, { reference });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Charge Direct Debit Mandate', description: 'Executes a charge on an active direct debit mandate to fund wallet.' })
  @ApiResponse({ status: 200, description: 'Charge processed successfully' })
  @Post('wallets/fiat/direct-debit/charge')
  async chargeDirectDebit(@Req() req, @Body() data: DirectDebitChargeDto) {
    return this.walletClient.send({ cmd: 'charge-direct-debit' }, { userId: req.user.id, ...data });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Deactivate Direct Debit Mandate', description: 'Deactivates an active direct debit mandate.' })
  @ApiResponse({ status: 200, description: 'Mandate deactivated' })
  @Post('wallets/fiat/direct-debit/deactivate')
  async deactivateDirectDebit(@Req() req, @Body() data: DirectDebitDeactivateDto) {
    return this.walletClient.send({ cmd: 'deactivate-direct-debit' }, { userId: req.user.id, ...data });
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  // @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get available tradeable currencies', description: 'Returns a list of all tradeable currencies from the provider.' })
  @ApiResponse({ status: 200, description: 'List of tradeable currencies' })
  @Get('wallet/assets/currencies')
  async getCurrencies() {
    return this.walletClient.send({ cmd: 'get-currencies' }, {});
  }
  
  @ApiTags('wallet')
  @ApiBearerAuth()
  // @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get available tradeable pairs grouped by source currency', description: 'Returns a mapping of which source currencies can be converted to which target currencies.' })
  @ApiResponse({ status: 200, description: 'List of tradeable pairs grouped by source currency' })
  @Get('wallet/assets/grouped-pairs')
  async getGroupedPairs() {
    return this.walletClient.send({ cmd: 'get-grouped-pairs' }, {});
  }

  @ApiTags('wallet')
  @ApiBearerAuth()
  // @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get all available tradeable pairs', description: 'Returns a list of all tradeable currency pairs from the provider.' })
  @ApiResponse({ status: 200, description: 'List of tradeable pairs' })
  @Get('wallet/assets/pairs')
  async getPairs() {
    return this.walletClient.send({ cmd: 'get-pairs' }, {});
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
      category: pagination.category,
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
  @ApiResponse({ status: 200, description: 'Login successful or device verification required', type: LoginResponseDto })
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
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get current user profile', description: 'Returns name, email, phone, user ID, account creation date and avatar URL.' })
  @ApiResponse({ status: 200, description: 'Profile details returned successfully' })
  @Get('users/profile')
  getProfile(@Req() req) {
    return this.userClient.send({ cmd: 'get-profile' }, { userId: req.user.id });
  }

  @ApiTags('profile')
  @ApiOperation({
    summary: 'Update basic user profile information',
    description: 'Updates names, DOB, phone, gender, country, and profile picture. Moves onboarding to the BVN stage.'
  })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @Post('users/profile')
  @UseInterceptors(FileInterceptor('profilePicture'))
  async updateProfile(
    @Body() data: UpdateProfileDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    let avatarUrl: string | undefined;
    if (file) {
      avatarUrl = await this.s3Service.uploadFile(file, 'profile');
    }
    return this.userClient.send({ cmd: 'update-profile' }, { ...data, avatarUrl });
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

  @ApiTags('profile')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Get onboarding progress and verification status',
    description: 'Returns the full verification checklist including tier level and dynamic statuses.'
  })
  @ApiResponse({ status: 200, description: 'Progress retrieved successfully' })
  @Get('users/verification-status')
  getOnboardingProgress(@Req() req) {
    return this.kycClient.send({ cmd: 'get-onboarding-progress' }, { userId: req.user.id });
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
    console.log(`[Gateway] Fetching dashboard overview for userId: ${req.user.id}`);
    return this.giftCardClient.send('get_trading_overview', { userId: req.user.id });
  }

  @ApiTags('dashboard')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get payout trend for charts', description: 'Returns time-series payout data for dashboard charts.' })
  @ApiResponse({ status: 200, type: [PayoutTrendDto] })
  @Get('dashboard/payout-trend')
  getPayoutTrend(@Req() req) {
    console.log(`[Gateway] Fetching payout trend for userId: ${req.user.id}`);
    return this.giftCardClient.send('get_payout_trend', { userId: req.user.id });
  }

  @ApiTags('auth')
  @ApiOperation({ summary: 'Verify a new device', description: 'Verifies a new device using the 6-digit OTP sent to the user\'s email after a login attempt from an unrecognized device.' })
  @ApiResponse({ status: 200, description: 'Device verified and trusted successfully', type: ApiResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid verification code or code has expired' })
  @ApiResponse({ status: 404, description: 'Device or user not found' })
  @Post('auth/verify-device')
  verifyDevice(@Body() data: VerifyDeviceDto) {
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

  // --- New Security & 2FA Endpoints ---

  @ApiTags('security')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Request Security OTP',
    description: 'Generates and sends a 6-digit OTP to the user\'s email for sensitive security actions like changing passwords or transaction PINs.'
  })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @Post('security/request-otp')
  requestSecurityOtp(@Req() req) {
    return this.authClient.send({ cmd: 'request-security-otp' }, { userId: req.user.id });
  }

  @ApiTags('security')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Change Account Password',
    description: 'Updates the login password. Requires the current password and a valid 6-digit OTP from /security/request-otp.'
  })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @Post('security/password/change')
  changePassword(@Req() req, @Body() data: ChangePasswordDto) {
    return this.authClient.send({ cmd: 'change-password' }, { ...data, userId: req.user.id });
  }

  @ApiTags('security')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Create Transaction PIN',
    description: 'Sets up a new 4-digit transaction PIN. Requires a valid 6-digit OTP.'
  })
  @ApiBody({ type: CreatePinDto })
  @ApiResponse({ status: 201, description: 'PIN created successfully' })
  @Post('security/pin/create')
  createPin(@Req() req, @Body() data: CreatePinDto) {
    return this.authClient.send({ cmd: 'create-pin' }, { ...data, userId: req.user.id });
  }

  @ApiTags('security')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Update Transaction PIN',
    description: 'Changes the existing 4-digit transaction PIN. Requires the old PIN and a valid 6-digit OTP.'
  })
  @ApiResponse({ status: 200, description: 'PIN updated successfully' })
  @Post('security/pin/update')
  updatePin(@Req() req, @Body() data: UpdatePinDto) {
    return this.authClient.send({ cmd: 'update-pin' }, { ...data, userId: req.user.id });
  }

  @ApiTags('security')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Validate Transaction PIN',
    description: 'Verifies the 4-digit PIN for sensitive transactions.'
  })
  @ApiResponse({ status: 200, description: 'PIN is valid' })
  @ApiResponse({ status: 403, description: 'Invalid PIN' })
  @Post('security/pin/validate')
  validatePin(@Req() req, @Body() data: ValidatePinDto) {
    return this.authClient.send({ cmd: 'validate-pin' }, { ...data, userId: req.user.id });
  }

  @ApiTags('security')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Generate 2FA Secret',
    description: 'Generates a new TOTP secret and a QR-code-ready URL for authenticator app setup.'
  })
  @ApiResponse({ status: 200, description: 'Secret generated successfully' })
  @Post('security/2fa/generate')
  generate2faSecret(@Req() req) {
    return this.authClient.send({ cmd: 'generate-2fa-secret' }, { userId: req.user.id });
  }

  @ApiTags('security')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Enable 2FA',
    description: 'Enables Two-Factor Authentication using a token from the authenticator app.'
  })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  @Post('security/2fa/enable')
  enable2fa(@Req() req, @Body() data: Enable2faDto) {
    return this.authClient.send({ cmd: 'enable-2fa' }, { ...data, userId: req.user.id });
  }

  @ApiTags('security')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Disable 2FA',
    description: 'Disables Two-Factor Authentication. Requires a valid 6-digit TOTP token.'
  })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  @Post('security/2fa/disable')
  disable2fa(@Req() req, @Body() data: Enable2faDto) {
    return this.authClient.send({ cmd: 'disable-2fa' }, { ...data, userId: req.user.id });
  }

  @ApiTags('auth')
  @ApiOperation({
    summary: 'Verify 2FA Login',
    description: 'Completes the login process for users who have 2FA enabled. Requires the token from their authenticator app.'
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA token' })
  @Post('auth/2fa/login')
  verify2faLogin(@Body() data: Verify2faDto & { userId: string }, @Req() req) {
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      deviceId: req.headers['x-device-id'],
    };
    return this.authClient.send({ cmd: 'verify-2fa-login' }, { ...data, metadata });
  }
}
