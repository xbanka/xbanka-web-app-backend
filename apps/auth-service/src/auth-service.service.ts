import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '@app/database';
import * as bcrypt from 'bcrypt';
import { OnboardingStep } from '@prisma/client';

@Injectable()
export class AuthServiceService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly jwtService: JwtService,
  ) { }

  async signup(data: any) {
    const { email, password, referralCode } = data;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new RpcException({
        message: 'User with this email already exists',
        status: 409,
      });
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        referralCode: Math.random().toString(36).substring(7),
        referredBy: referralCode,
        currentStep: OnboardingStep.SIGNUP,
      },
    });

    const { password: _, ...result } = user;
    return result;
  }

  async verifyEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new RpcException({
        message: 'User not found',
        status: 404,
      });
    }

    const updatedUser = await this.prisma.user.update({
      where: { email },
      data: {
        isEmailVerified: true,
        currentStep: OnboardingStep.EMAIL_VERIFIED,
      },
    });

    const { password: _, ...result } = updatedUser;
    return result;
  }

  async login(data: any) {
    const { email, password } = data;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new RpcException({
        message: 'Invalid credentials',
        status: 401,
      });
    }

    if (!user.password) {
      throw new RpcException({
        message: 'This account uses Google Sign-In. Please sign in with Google.',
        status: 401,
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new RpcException({
        message: 'Invalid credentials',
        status: 401,
      });
    }

    const payload = { sub: user.id, email: user.email };
    const { password: _, ...userWithoutPassword } = user;

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: userWithoutPassword,
    };
  }

  async googleLogin(googleUser: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string;
  }) {
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: googleUser.googleId }, { email: googleUser.email }],
      },
      include: { profile: true },
    });

    if (!user) {
      // New user: create account and profile
      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          googleId: googleUser.googleId,
          isEmailVerified: true,
          currentStep: OnboardingStep.EMAIL_VERIFIED,
          referralCode: Math.random().toString(36).substring(7),
          profile: {
            create: {
              firstName: googleUser.firstName,
              lastName: googleUser.lastName,
              avatarUrl: googleUser.avatarUrl,
            },
          },
        },
        include: { profile: true },
      });
    } else if (!user.googleId) {
      // Existing email user: link their Google account
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.googleId,
          isEmailVerified: true,
          profile: {
            upsert: {
              create: {
                firstName: googleUser.firstName,
                lastName: googleUser.lastName,
                avatarUrl: googleUser.avatarUrl,
              },
              update: { avatarUrl: googleUser.avatarUrl },
            },
          },
        },
        include: { profile: true },
      });
    }

    const payload = { sub: user.id, email: user.email };
    const { password: _, ...userWithoutPassword } = user;

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: userWithoutPassword,
    };
  }
}
