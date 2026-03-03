import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
    @ApiProperty({ example: 'user@example.com' })
    email: string;

    @ApiProperty({ example: 'strongpassword123' })
    password: string;

    @ApiProperty({ example: 'referral123', required: false })
    referralCode?: string;
}

export class VerifyBvnDto {
    @ApiProperty({ example: 'user-uuid-here' })
    userId: string;

    @ApiProperty({ example: '12345678901' })
    bvn: string;
}

export class ApiResponseDto<T> {
    @ApiProperty()
    message: string;

    @ApiProperty()
    details: string;

    @ApiProperty()
    errorGroup: string;

    @ApiProperty()
    data: T;
}
