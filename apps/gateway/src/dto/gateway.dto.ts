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

export class VerifyEmailDto {
    @ApiProperty({
        description: 'The email address to verify',
        example: 'user@example.com',
    })
    @IsEmail()
    email: string;
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
