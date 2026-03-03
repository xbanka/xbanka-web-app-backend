import { Injectable, ConflictException } from '@nestjs/common';
import { DatabaseService } from '@app/database';

@Injectable()
export class AuthServiceService {
  constructor(private readonly prisma: DatabaseService) { }

  async signup(data: any) {
    const { email, password, referralCode } = data;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password (TODO: use bcrypt)

    const user = await this.prisma.user.create({
      data: {
        email,
        password, // TODO: hash this
        referralCode: Math.random().toString(36).substring(7),
        referredBy: referralCode,
      },
    });

    return user;
  }
}
