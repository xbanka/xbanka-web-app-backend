import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, MinLength, IsOptional, IsUUID } from 'class-validator';

export class SignupDto {
    @ApiProperty({
        description: 'The email address for the new account',
        example: 'user@example.com',
        format: 'email',
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'A strong password for the account (minimum 8 characters)',
        example: 'StrongP@ssw0rd123!',
        minLength: 8,
    })
    @IsString()
    @MinLength(8)
    password: string;

    @ApiProperty({
        description: 'Optional referral code from another user',
        example: 'referral123',
        required: false,
    })
    @IsOptional()
    @IsString()
    referralCode?: string;
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

export class VerifyEmailDto {
    @ApiProperty({
        description: 'The email address to verify',
        example: 'user@example.com',
    })
    @IsEmail()
    email: string;
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

    @ApiProperty({ description: 'URL of the ID document image', example: 'https://storage.example.com/id.jpg' })
    @IsString()
    idImageUrl: string;
}

export class UpdateSelfieDto {
    @ApiProperty({ description: 'The unique ID of the user', example: 'uuid-here' })
    @IsUUID()
    userId: string;

    @ApiProperty({ description: 'URL of the selfie image', example: 'https://storage.example.com/selfie.jpg' })
    @IsString()
    selfieUrl: string;
}

export class UpdateAddressDto {
    @ApiProperty({ description: 'The unique ID of the user', example: 'uuid-here' })
    @IsUUID()
    userId: string;

    @ApiProperty({ description: 'Street address', example: '123 Main St' })
    @IsString()
    address: string;

    @ApiProperty({ description: 'URL of the proof of address document', example: 'https://storage.example.com/utility-bill.jpg' })
    @IsString()
    proofOfAddress: string;
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
    @IsString()
    @IsNotEmpty()
    @MinLength(11)
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

    @ApiProperty({ example: 'DEPOSIT', enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT'] })
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
}
