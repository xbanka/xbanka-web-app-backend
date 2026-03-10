import { Injectable, Inject } from '@nestjs/common';
import { RpcException, ClientProxy } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '@app/database';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OnboardingStep } from '@prisma/client';

@Injectable()
export class AuthServiceService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly jwtService: JwtService,
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
  ) { }

  async signup(data: any) {
    const { email, password, referralCode, redirectUrl } = data;


    if (!redirectUrl) {
      throw new RpcException({
        message: 'Redirect URL is required',
        status: 400,
      });
    }

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

    // Generate long string verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Extended to 24 hours for long tokens

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        referralCode: Math.random().toString(36).substring(7),
        referredBy: referralCode,
        currentStep: OnboardingStep.SIGNUP,
        verificationToken,
        verificationTokenExpiresAt: expiresAt,
      },
    });

    const verificationUrl = redirectUrl ? `${redirectUrl}?token=${verificationToken}` : null;

    // Send Welcome Email
    this.notificationClient.emit('send_email', {
      to: email,
      subject: 'Welcome to Xbanka - Verify Your Email',
      body: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #333;">Welcome to Xbanka!</h2>
          <p>Thank you for signing up. Please verify your email address to get started.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a>
          </div>
          <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #007bff; font-size: 12px;">${verificationUrl}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
        </div>
      `,
    });

    // remove password, verificationToken, verificationTokenExpiresAt
    const { password: _, verificationToken: __, verificationTokenExpiresAt: ___, ...result } = user;
    // Log the token for dev purposes
    console.log(`[Signup] Verification token for ${email}: ${verificationToken}. Redirect URL: ${redirectUrl}`);

    const response_daa = { ...result, redirectUrl: verificationUrl }
    return response_daa;
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new RpcException({
        message: 'Invalid or expired verification token',
        status: 400,
      });
    }

    if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
      throw new RpcException({
        message: 'Verification token has expired',
        status: 400,
      });
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verificationToken: null,
        verificationTokenExpiresAt: null,
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

  async resendVerification(data: { email: string; redirectUrl: string }) {
    const { email, redirectUrl } = data;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new RpcException({
        message: 'User with this email does not exist',
        status: 404,
      });
    }

    if (user.isEmailVerified) {
      throw new RpcException({
        message: 'Email is already verified',
        status: 400,
      });
    }

    // Generate new long string verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpiresAt: expiresAt,
      },
    });

    const verificationUrl = `${redirectUrl}?token=${verificationToken}`;

    // Send Verification Email
    this.notificationClient.emit('send_email', {
      to: email,
      subject: 'Xbanka - Verify Your Email',
      body: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Please verify your email address to continue your onboarding.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a>
          </div>
          <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #007bff; font-size: 12px;">${verificationUrl}</p>
        </div>
      `,
    });

    console.log(`[Resend Verification] New token for ${email}: ${verificationToken}. Redirect URL: ${redirectUrl}`);

    return { message: 'Verification email resent successfully' };
  }
}
