import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, MinLength, IsOptional, IsUUID, IsNumberString, Length, IsNumber, Min } from 'class-validator';

export class SignupDto {
    @ApiProperty({
        description: 'The email address for the new account',
        example: 'user@example.com',
        format: 'email',
    })
    @IsNotEmpty({ message: 'Email is required' })
    @IsEmail({}, { message: 'Invalid email format' })
    email: string;

    @ApiProperty({
        description: 'A strong password for the account (minimum 8 characters)',
        example: 'StrongP@ssw0rd123!',
        minLength: 8,
    })
    @IsNotEmpty({ message: 'Password is required' })
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    password: string;

    @IsOptional()
    @IsString()
    referralCode?: string;

    @ApiProperty({
        description: 'Frontend URL to redirect the user after email verification',
        example: 'https://app.xbankang.com/verify-email',
    })
    @IsString()
    redirectUrl: string;
}

export class LoginDto {
    @ApiProperty({
        description: 'The email address associated with the account',
        example: 'user@example.com',
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'The account password',
        example: 'StrongP@ssw0rd123!',
    })
    @IsString()
    @MinLength(8)
    password: string;
}

export class LoginResponseDto {
    @ApiProperty({ description: 'The access token for authentication', required: false })
    access_token?: string;

    @ApiProperty({ description: 'The user object', required: false })
    user?: any;

    @ApiProperty({ description: 'The session object', required: false })
    session?: any;

    @ApiProperty({ description: 'The status of the login process', enum: ['DEVICE_VERIFICATION_REQUIRED', 'SUCCESS'], required: false })
    status?: string;

    @ApiProperty({ description: 'The user ID (required for device verification)', required: false })
    userId?: string;

    @ApiProperty({ description: 'The device ID (required for device verification)', required: false })
    deviceId?: string;

    @ApiProperty({ description: 'A helpful message', required: false })
    message?: string;
}

export class VerifyDeviceDto {
    @ApiProperty({ description: 'The unique ID of the user', example: 'uuid-here' })
    @IsUUID()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ description: 'The unique ID of the device', example: 'device-uuid-here' })
    @IsString()
    @IsNotEmpty()
    deviceId: string;

    @ApiProperty({ description: 'The 6-digit OTP sent to the user\'s email', example: '123456' })
    @IsString()
    @IsNotEmpty()
    @Length(6, 6)
    code: string;
}

export class VerifyEmailDto {
    @ApiProperty({
        description: 'The hexadecimal verification token sent via email',
        example: 'a1b2c3d4e5f6...',
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(32)
    token: string;
}

export class UpdateProfileDto {
    @ApiProperty({ description: 'The unique ID of the user', example: 'uuid-here' })
    @IsUUID()
    userId: string;

    @ApiProperty({ description: 'User first name', example: 'John' })
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @ApiProperty({ description: 'User last name', example: 'Doe' })
    @IsString()
    @IsNotEmpty()
    lastName: string;

    @ApiProperty({ description: 'Date of birth', example: '1990-01-01T00:00:00.000Z' })
    @IsString()
    dateOfBirth: string;

    @ApiProperty({ description: 'Phone number', example: '+2348012345678' })
    @IsString()
    phoneNumber: string;

    @ApiProperty({ description: 'Gender', example: 'Male' })
    @IsString()
    gender: string;

    @ApiProperty({ description: 'Country of residence', example: 'Nigeria' })
    @IsString()
    country: string;

    @ApiProperty({ type: 'string', format: 'binary', required: false })
    @IsOptional()
    profilePicture?: any;
}

export class UpdateIdentityDto {
    @ApiProperty({ description: 'The unique ID of the user', example: 'uuid-here' })
    @IsUUID()
    userId: string;

    @ApiProperty({ description: 'Type of ID (e.g. PASSPORT, DRIVERS_LICENSE)', example: 'PASSPORT' })
    @IsString()
    idType: string;

    @ApiProperty({ description: 'The ID number', example: 'A12345678' })
    @IsString()
    idNumber: string;
}

export class UpdateSelfieDto {
    @ApiProperty({ description: 'The unique ID of the user', example: 'uuid-here' })
    @IsUUID()
    userId: string;
}

export class UpdateAddressDto {
    @ApiProperty({ description: 'The unique ID of the user', example: 'uuid-here' })
    @IsUUID()
    userId: string;

    @ApiProperty({ description: 'Street address', example: '123 Main St' })
    @IsString()
    @IsNotEmpty()
    address: string;

    @ApiProperty({ description: 'Popular landmark near the address', example: 'Beside Total Station', required: false })
    @IsString()
    @IsOptional()
    landmark?: string;

    @ApiProperty({ description: 'Country of residence', example: 'Nigeria' })
    @IsString()
    @IsNotEmpty()
    country: string;

    @ApiProperty({ description: 'State of residence', example: 'Lagos' })
    @IsString()
    @IsNotEmpty()
    state: string;

    @ApiProperty({ description: 'Type of document (e.g. Utility Bill, Bank Statement)', example: 'Utility Bill' })
    @IsString()
    @IsNotEmpty()
    documentType: string;
}

export class SkipStepDto {
    @ApiProperty({ description: 'The unique ID of the user', example: 'uuid-here' })
    @IsUUID()
    userId: string;
}

export class VerifyBvnDto {
    @ApiProperty({
        description: 'The unique ID of the user being verified',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsUUID()
    userId: string;

    @ApiProperty({
        description: 'The 11-digit Bank Verification Number',
        example: '12345678901',
        minLength: 11,
        maxLength: 11,
    })
    @IsNumberString()
    @IsNotEmpty()
    @Length(11, 11, { message: 'BVN must be exactly 11 digits' })
    @IsString()
    bvn: string;
}

export class ApiResponseDto<T> {
    @ApiProperty({
        description: 'A human-readable message describing the result',
        example: 'Operation successful',
    })
    message: string;

    @ApiProperty({
        description: 'Detailed information or error context',
        example: 'User created successfully',
    })
    details: string;

    @ApiProperty({
        description: 'High-level error classification',
        example: 'NONE',
    })
    errorGroup: string;

    @ApiProperty({
        description: 'The actual response data',
    })
    data: T;
}

// --- Pagination DTOs ---

export class PaginationQueryDto {
    @ApiProperty({ description: 'The page number to retrieve', example: 1, default: 1, required: false })
    @IsOptional()
    @IsString() // Use string if passed via URL, can be converted or used with @Type
    page?: string;

    @ApiProperty({ description: 'The number of items per page', example: 10, default: 10, required: false })
    @IsOptional()
    @IsString()
    limit?: string;

    @ApiProperty({ description: 'Filter by category (FIAT, CRYPTO, GIFTCARD)', example: 'FIAT', required: false })
    @IsOptional()
    @IsString()
    category?: string;
}

export class PaginationMetaDto {
    @ApiProperty({ description: 'Total number of items', example: 50 })
    totalItems: number;

    @ApiProperty({ description: 'Items per page', example: 10 })
    itemCount: number;

    @ApiProperty({ description: 'Number of items per page', example: 10 })
    itemsPerPage: number;

    @ApiProperty({ description: 'Total number of pages', example: 5 })
    totalPages: number;

    @ApiProperty({ description: 'Current page number', example: 1 })
    currentPage: number;
}

export class PaginatedResponseDto<T> {
    @ApiProperty({ description: 'The paginated data' })
    items: T[];

    @ApiProperty({ description: 'Pagination metadata' })
    meta: PaginationMetaDto;
}

// --- Wallet & Bank DTOs ---

export class WalletResponseDto {
    @ApiProperty({ example: 'uuid-123' })
    id: string;

    @ApiProperty({ example: 'NGN' })
    currency: string;

    @ApiProperty({ example: 25000.50 })
    balance: number;

    @ApiProperty({ example: '2026-03-07T10:00:00Z' })
    createdAt: Date;
}

export class BankDetailDto {
    @ApiProperty({ example: 'GTBank', description: 'Name of the bank' })
    @IsString()
    @IsNotEmpty()
    bankName: string;

    @ApiProperty({ example: '0123456789', description: '10-digit account number' })
    @IsString()
    @IsNotEmpty()
    @MinLength(10)
    accountNumber: string;

    @ApiProperty({ example: 'JOHN DOE', description: 'Account holder name' })
    @IsString()
    @IsNotEmpty()
    accountName: string;
}

export class BankDetailResponseDto extends BankDetailDto {
    @ApiProperty({ example: 'uuid-456' })
    id: string;

    @ApiProperty({ example: true })
    isVerified: boolean;
}

export class TransactionResponseDto {
    @ApiProperty({ example: 'uuid-789' })
    id: string;

    @ApiProperty({ example: 'DEPOSIT', enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'TRADE', 'CONVERSION'] })
    type: string;

    @ApiProperty({ example: 'COMPLETED', enum: ['PENDING', 'COMPLETED', 'FAILED'] })
    status: string;

    @ApiProperty({ example: 5000.00 })
    amount: number;

    @ApiProperty({ example: 'NGN' })
    currency: string;

    @ApiProperty({ example: 'TXN-REF-123456' })
    reference: string;

    @ApiProperty({ example: 'Wallet funding' })
    note: string;

    @ApiProperty({ example: '2026-03-07T10:30:00Z' })
    createdAt: Date;

    @ApiProperty({ example: 'FIAT', enum: ['FIAT', 'CRYPTO', 'GIFTCARD'] })
    category: string;
}

// --- Gift Card DTOs ---

export class GiftCardCategoryDto {
    @ApiProperty({ example: 'uuid-cat-1' })
    id: string;

    @ApiProperty({ example: 'PHYSICAL' })
    name: string;
}

export class GiftCardRegionDto {
    @ApiProperty({ example: 'uuid-reg-1' })
    id: string;

    @ApiProperty({ example: 'USA' })
    name: string;
}

export class GiftCardVariantDto {
    @ApiProperty({ example: 'uuid-var-1' })
    id: string;

    @ApiProperty({ type: GiftCardCategoryDto })
    category: GiftCardCategoryDto;

    @ApiProperty({ type: GiftCardRegionDto })
    region: GiftCardRegionDto;

    @ApiProperty({ example: 750 })
    rate: number;

    @ApiProperty({ example: 1.2 })
    dailyChange: number;
}

export class GiftCardDto {
    @ApiProperty({ example: 'uuid-brand-1' })
    id: string;

    @ApiProperty({ example: 'Apple' })
    name: string;

    @ApiProperty({ example: 'https://example.com/apple.png' })
    logoUrl: string;

    @ApiProperty({ type: [GiftCardVariantDto] })
    variants: GiftCardVariantDto[];
}

export class SellGiftCardDto {
    @ApiProperty({ example: 'uuid-var-1', description: 'ID of the specific gift card variant' })
    @IsString()
    @IsNotEmpty()
    variantId: string;

    @ApiProperty({ example: 100, description: 'Amount in USD' })
    @IsNotEmpty()
    amount: number;

    @ApiProperty({ example: 'XYZ-123-ABC', required: false })
    @IsOptional()
    @IsString()
    code?: string;

    @ApiProperty({ example: 'https://storage.com/proof.jpg', required: false })
    @IsOptional()
    @IsString()
    imageUrl?: string;
}

export class TradingOverviewDto {
    @ApiProperty({ example: 23 })
    cardsSold: number;

    @ApiProperty({ example: 22456235.00 })
    totalPayout: number;

    @ApiProperty({ example: 'Amazon' })
    topTradedCard: string;
}

export class PayoutTrendDto {
    @ApiProperty({ example: '2026-03-01' })
    date: string;

    @ApiProperty({ example: 85000 })
    amount: number;
}

export class ResendVerificationDto {
    @ApiProperty({
        description: 'The email address associated with the account',
        example: 'user@example.com',
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'Frontend URL to redirect the user after email verification',
        example: 'https://app.xbankang.com/verify-email',
    })
    @IsString()
    redirectUrl: string;
}

// --- NUBAN & Account Lookup DTOs ---

export class GenerateNubanDto {
    @ApiProperty({
        description: 'The 9-digit account serial number',
        example: '000000001',
        minLength: 9,
        maxLength: 9,
    })
    @IsNumberString()
    @IsNotEmpty()
    @Length(9, 9, { message: 'Serial number must be exactly 9 digits' })
    serialNumber: string;
}

export class AccountLookupDto {
    @ApiProperty({
        description: 'The 10-digit Nigerian account number',
        example: '1234567890',
        minLength: 10,
        maxLength: 10,
    })
    @IsNumberString()
    @IsNotEmpty()
    @Length(10, 10, { message: 'Account number must be exactly 10 digits' })
    accountNumber: string;

    @ApiProperty({
        description: 'The 3-digit bank code (optional but recommended for faster lookup)',
        example: '950',
        required: false,
        minLength: 3,
        maxLength: 3,
    })
    @IsOptional()
    @IsNumberString()
    @Length(3, 3, { message: 'Bank code must be exactly 3 digits' })
    @Length(3, 3, { message: 'Bank code must be exactly 3 digits' })
    bankCode?: string;
}

export class RequestSecurityOtpDto {
    @ApiProperty({ description: 'The email of the user requesting the OTP', example: 'user@example.com' })
    @IsEmail()
    email: string;
}

export class ChangePasswordDto {
    @ApiProperty({ description: 'The current password of the user' })
    @IsString()
    @MinLength(6)
    oldPassword: string;

    @ApiProperty({ description: 'The new password to set' })
    @IsString()
    @MinLength(6)
    newPassword: string;

    @ApiProperty({ description: 'The 6-digit OTP sent to the user email', example: '123456' })
    @IsString()
    @Length(6, 6)
    otp: string;
}

export class CreatePinDto {
    @ApiProperty({ description: 'The 4-digit transaction PIN to set', example: '1234' })
    @IsString()
    @IsNumberString()
    @Length(4, 4)
    pin: string;

    @ApiProperty({ description: 'The 6-digit OTP sent to the user email', example: '123456' })
    @IsString()
    @Length(6, 6)
    otp: string;
}

export class UpdatePinDto {
    @ApiProperty({ description: 'The current 4-digit transaction PIN', example: '1234' })
    @IsString()
    @IsNumberString()
    @Length(4, 4)
    oldPin: string;

    @ApiProperty({ description: 'The new 4-digit transaction PIN to set', example: '5678' })
    @IsString()
    @IsNumberString()
    @Length(4, 4)
    newPin: string;

    @ApiProperty({ description: 'The 6-digit OTP sent to the user email', example: '123456' })
    @IsString()
    @Length(6, 6)
    otp: string;
}

export class ValidatePinDto {
    @ApiProperty({ description: 'The 4-digit transaction PIN to validate', example: '1234' })
    @IsString()
    @IsNumberString()
    @Length(4, 4)
    pin: string;
}

export class Enable2faDto {
    @ApiProperty({ description: 'The 6-digit TOTP token from the authenticator app', example: '123456' })
    @IsString()
    @Length(6, 6)
    token: string;
}

export class Verify2faDto {
    @ApiProperty({ description: 'The 6-digit TOTP token', example: '123456' })
    @IsString()
    @Length(6, 6)
    token: string;
}

export class ConvertQuoteDto {
    @ApiProperty({ description: 'The currency to convert from', example: 'USDT' })
    @IsString()
    @IsNotEmpty()
    sourceCurrency: string;

    @ApiProperty({ description: 'The currency to convert to', example: 'NGN' })
    @IsString()
    @IsNotEmpty()
    targetCurrency: string;

    @ApiProperty({ description: 'The amount to convert (in source currency)', example: 100 })
    @IsNotEmpty()
    amount: number;

    @ApiProperty({ description: 'Trade action (BUY or SELL)', example: 'SELL', required: false })
    @IsOptional()
    @IsString()
    action?: string;
}

export class ConvertExecuteDto {
    @ApiProperty({ description: 'The quote ID received from the quote endpoint', example: 'quote-uuid-from-obiex' })
    @IsString()
    @IsNotEmpty()
    quoteId: string;

    @ApiProperty({ description: 'The currency to convert from', example: 'USDT' })
    @IsString()
    @IsNotEmpty()
    sourceCurrency: string;

    @ApiProperty({ description: 'The currency to convert to', example: 'NGN' })
    @IsString()
    @IsNotEmpty()
    targetCurrency: string;

    @ApiProperty({ description: 'The amount to convert (must match the quote)', example: 100 })
    @IsNotEmpty()
    amount: number;
}

export class ConvertQuoteResponseDto {
    @ApiProperty({ example: 'quote-uuid-123' })
    quoteId: string;

    @ApiProperty({ example: 'USDT' })
    sourceCurrency: string;

    @ApiProperty({ example: 'NGN' })
    targetCurrency: string;

    @ApiProperty({ example: 100 })
    sourceAmount: number;

    @ApiProperty({ example: 1550.50 })
    rate: number;

    @ApiProperty({ example: 155050.00 })
    grossPayout: number;

    @ApiProperty({ example: 2325.75 })
    adminFee: number;

    @ApiProperty({ example: 152724.25 })
    netPayout: number;

    @ApiProperty({ example: '2026-03-26T10:00:00Z' })
    expiresAt: string;
}

export class WithdrawCryptoDto {
    @ApiProperty({ description: 'The currency to withdraw (e.g., USDT, BTC)', example: 'USDT' })
    @IsNotEmpty()
    currency: string;

    @ApiProperty({ description: 'The network to use (e.g., ERC20, TRC20, BITCOIN)', example: 'TRC20' })
    @IsNotEmpty()
    network: string;

    @ApiProperty({ description: 'The recipient wallet address', example: 'TR7NHqjiSZTp6uu3rpkDxJFCH8L7Lx2puz' })
    @IsNotEmpty()
    address: string;

    @ApiProperty({ description: 'The amount to withdraw', example: 100 })
    @IsNumber()
    @Min(0.00000001)
    amount: number;

    @ApiProperty({ description: 'Optional memo for some networks (e.g., XRP, EOS)', required: false })
    @IsOptional()
    memo?: string;

    @ApiProperty({ description: 'Optional narration for the transaction', required: false })
    @IsOptional()
    narration?: string;
}

export class RateCalculatorDto {
    @ApiProperty({ description: 'The currency to convert from', example: 'USDT' })
    @IsString()
    @IsNotEmpty()
    sourceCurrency: string;

    @ApiProperty({ description: 'The currency to convert to', example: 'NGN' })
    @IsString()
    @IsNotEmpty()
    targetCurrency: string;

    @ApiProperty({ description: 'The amount to convert (in source currency)', example: 100 })
    @IsNumber()
    @Min(0)
    amount: number;

    @ApiProperty({ description: 'Trade action (BUY or SELL)', example: 'SELL', required: false })
    @IsOptional()
    @IsString()
    action?: string;
}

export class RateCalculatorResponseDto {
    @ApiProperty({ example: 'USDT' })
    sourceCurrency: string;

    @ApiProperty({ example: 'NGN' })
    targetCurrency: string;

    @ApiProperty({ example: 100 })
    sourceAmount: number;

    @ApiProperty({ example: 1550.50 })
    rate: number;

    @ApiProperty({ example: 155050.00 })
    grossPayout: number;

    @ApiProperty({ example: 2325.75 })
    adminFee: number;

    @ApiProperty({ example: 152724.25 })
    netPayout: number;

    @ApiProperty({ example: '1 USDT ≈ 1,550.50 NGN' })
    estimatedPrice: string;
}

export class InitiateFundingDto {
    @ApiProperty({ description: 'The amount to fund in NGN', example: 5000 })
    @IsNumber()
    @Min(100)
    amount: number;


    @ApiProperty({ description: 'Frontend URL to redirect to after direct debit mandate approval', example: 'https://app.xbankang.com/mandate-success', required: false })
    @IsOptional()
    @IsString()
    callback_url?: string;
}

export class FundingResponseDto {
    @ApiProperty({ description: 'The Paystack authorization URL', example: 'https://paystack.com/checkout/...' })
    authorization_url: string;

    @ApiProperty({ description: 'The unique transaction reference', example: 'DEP-123456789' })
    reference: string;

    @ApiProperty({ description: 'The Paystack access code', example: '...' })
    access_code: string;
}

export class DirectDebitInitiateDto {
    @ApiProperty({ description: 'Frontend URL to redirect to after direct debit mandate approval', example: 'https://app.xbankang.com/mandate-success', required: false })
    @IsOptional()
    @IsString()
    callback_url?: string;

    @ApiProperty({ description: 'Account number to pre-fill the mandate request', example: '0128034955', required: false })
    @IsOptional()
    @IsString()
    accountNumber?: string;

    @ApiProperty({ description: 'Bank code to pre-fill the mandate request. MUST be a supported Paystack direct debit bank code.', example: '058', required: false })
    @IsOptional()
    @IsString()
    bankCode?: string;
}

export class DirectDebitChargeDto {
    @ApiProperty({ description: 'The mandate ID', example: 'mandate-uuid-123' })
    @IsString()
    @IsNotEmpty()
    mandateId: string;

    @ApiProperty({ description: 'The amount to charge the user', example: 5000 })
    @IsNumber()
    @Min(100)
    amount: number;
}

export class DirectDebitDeactivateDto {
    @ApiProperty({ description: 'The mandate ID you want to deactivate', example: 'mandate-uuid-abc' })
    @IsString()
    @IsNotEmpty()
    mandateId: string;
}
