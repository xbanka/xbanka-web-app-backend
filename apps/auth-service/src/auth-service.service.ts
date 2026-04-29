import { Injectable, Inject } from '@nestjs/common';
import { RpcException, ClientProxy } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '@app/database';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OnboardingStep } from '@prisma/client';

@Injectable()
export class AuthServiceService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
    const { email, password, metadata } = data;
    const { deviceId, deviceName, deviceType, ipAddress, userAgent } = metadata || {};

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

    // if (!deviceId) {
    //   throw new RpcException({
    //     message: 'Device ID is required for security verification',
    //     status: 400,
    //   });
    // }

    // --- Device & Session Logic ---
    // let device = await this.prisma.device.findUnique({
    //   where: { userId_deviceId: { userId: user.id, deviceId: deviceId } },
    // });

    // if (!device) {
    //   device = await this.prisma.device.create({
    //     data: {
    //       userId: user.id,
    //       deviceId: deviceId || 'unknown',
    //       name: deviceName || 'Unknown Device',
    //       type: deviceType || 'WEB',
    //       isTrusted: false, // Must verify via OTP
    //     },
    //   });
    // }

    // if (!device.isTrusted) {
    //   // Generate OTP
    //   const otp = Math.floor(100000 + Math.random() * 900000).toString();
    //   const expiresAt = new Date();
    //   expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    //   await this.prisma.device.update({
    //     where: { id: device.id },
    //     data: {
    //       verificationToken: otp,
    //       verificationTokenExpiresAt: expiresAt,
    //     },
    //   });

    //   // Send OTP Email
    //   this.notificationClient.emit('send_email', {
    //     to: user.email,
    //     subject: 'XBanka - New Device Login OTP',
    //     body: `<p>Your verification code for the new device <b>${device.name}</b> is: <h2>${otp}</h2></p>`,
    //   });

    //   return {
    //     status: 'DEVICE_VERIFICATION_REQUIRED',
    //     userId: user.id,
    //     deviceId: device.deviceId,
    //     message: 'Verification code sent to email',
    //   };
    // }

    // if (user.isTwoFactorEnabled) {
    //   return {
    //     status: '2FA_REQUIRED',
    //     userId: user.id,
    //     message: 'Authenticator code required',
    //   };
    // }

    // Create Session
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        deviceId: deviceId || 'unknown',
        // deviceId: device.id,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    const payload = { sub: user.id, email: user.email, sid: session.id };
    const { password: _, ...userWithoutPassword } = user;

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-super-secret-change-me';

    return {
      access_token: await this.jwtService.signAsync(payload),
      refresh_token: await this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: '7d',
      }),
      user: userWithoutPassword,
      session: {
        id: session.id,
        deviceName: deviceName || 'Unknown Device',
        // deviceName: device.name,
        lastActiveAt: session.lastActiveAt,
      },
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
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-super-secret-change-me';

    return {
      access_token: await this.jwtService.signAsync(payload),
      refresh_token: await this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: '7d',
      }),
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

  async verifyDevice(data: { userId: string; deviceId: string; code: string }) {
    const { userId, deviceId, code } = data;

    const device = await this.prisma.device.findFirst({
      where: { userId, deviceId },
    });

    if (!device || device.verificationToken !== code) {
      throw new RpcException({ message: 'Invalid verification code', status: 400 });
    }

    if (device.verificationTokenExpiresAt && device.verificationTokenExpiresAt < new Date()) {
      throw new RpcException({ message: 'Verification code expired', status: 400 });
    }

    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        isTrusted: true,
        verificationToken: null,
        verificationTokenExpiresAt: null,
      },
    });

    return { message: 'Device verified and trusted successfully' };
  }

  async getSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, isRevoked: false },
      include: { device: true },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  async revokeSession(data: { userId: string; sessionId: string }) {
    await this.prisma.session.updateMany({
      where: { id: data.sessionId, userId: data.userId },
      data: { isRevoked: true },
    });
    return { message: 'Session revoked successfully' };
  }

  async getDevices(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  async removeDevice(data: { userId: string; deviceId: string }) {
    await this.prisma.device.deleteMany({
      where: { id: data.deviceId, userId: data.userId },
    });
    return { message: 'Device removed successfully' };
  }

  async validateSession(data: { sessionId: string; userId: string }) {
    const session = await this.prisma.session.findFirst({
      where: { id: data.sessionId, userId: data.userId, isRevoked: false },
    });
    return !!session;
  }

  // --- Security: OTP for Credentials ---

  async requestSecurityOtp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new RpcException({ message: 'User not found', status: 404 });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await this.prisma.user.update({
      where: { id: userId },
      data: { securityOtp: otp, securityOtpExpiresAt: expiresAt },
    });

    this.notificationClient.emit('send_email', {
      to: user.email,
      subject: 'XBanka - Security Verification Code',
      body: `<p>Your security verification code is: <h2>${otp}</h2></p><p>This code expires in 15 minutes.</p>`,
    });

    return { message: 'Security OTP sent to email' };
  }

  private async validateSecurityOtp(userId: string, otp: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.securityOtp !== otp) {
      throw new RpcException({ message: 'Invalid security code', status: 400 });
    }
    if (user.securityOtpExpiresAt && user.securityOtpExpiresAt < new Date()) {
      throw new RpcException({ message: 'Security code expired', status: 400 });
    }

    // Clear OTP after successful validation
    await this.prisma.user.update({
      where: { id: userId },
      data: { securityOtp: null, securityOtpExpiresAt: null },
    });
  }

  // --- Security: Password & PIN ---

  async changePassword(data: any) {
    const { userId, oldPassword, newPassword, otp } = data;
    await this.validateSecurityOtp(userId, otp);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) throw new RpcException({ message: 'User password not found', status: 400 });

    const isMatched = await bcrypt.compare(oldPassword, user.password);
    if (!isMatched) throw new RpcException({ message: 'Incorrect current password', status: 400 });

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async createPin(data: any) {
    const { userId, pin, otp } = data;
    await this.validateSecurityOtp(userId, otp);

    const salt = await bcrypt.genSalt();
    const hashedPin = await bcrypt.hash(pin, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { transactionPin: hashedPin },
    });

    return { message: 'Transaction PIN created successfully' };
  }

  async updatePin(data: any) {
    const { userId, oldPin, newPin, otp } = data;
    await this.validateSecurityOtp(userId, otp);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.transactionPin) throw new RpcException({ message: 'No existing PIN found', status: 400 });

    const isMatched = await bcrypt.compare(oldPin, user.transactionPin);
    if (!isMatched) throw new RpcException({ message: 'Incorrect current values', status: 400 });

    const salt = await bcrypt.genSalt();
    const hashedPin = await bcrypt.hash(newPin, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { transactionPin: hashedPin },
    });

    return { message: 'Transaction PIN updated successfully' };
  }

  async validatePin(data: { userId: string; pin: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user || !user.transactionPin) throw new RpcException({ message: 'Transaction PIN not set', status: 400 });

    const isValid = await bcrypt.compare(data.pin, user.transactionPin);
    if (!isValid) throw new RpcException({ message: 'Invalid transaction PIN', status: 403 });

    return { valid: true };
  }

  // --- Security: Manual TOTP (RFC 6238) ---

  async generate2faSecret(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new RpcException({ message: 'User not found', status: 404 });

    // Manual Base32 generation for secret
    const secret = crypto.randomBytes(20).toString('hex').slice(0, 32); 
    const otpAuthUrl = `otpauth://totp/XBanka:${user.email}?secret=${secret}&issuer=XBanka`;

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return { secret, otpAuthUrl };
  }

  async enable2fa(data: { userId: string; token: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user || !user.twoFactorSecret) throw new RpcException({ message: 'Secret not generated', status: 400 });

    const isValid = await this.verifyTotp(user.twoFactorSecret, data.token);
    if (!isValid) throw new RpcException({ message: 'Invalid verification token', status: 400 });

    await this.prisma.user.update({
      where: { id: data.userId },
      data: { isTwoFactorEnabled: true },
    });

    return { message: '2FA enabled successfully' };
  }

  async disable2fa(data: { userId: string; token: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new RpcException({ message: '2FA is not enabled', status: 400 });
    }

    const isValid = await this.verifyTotp(user.twoFactorSecret, data.token);
    if (!isValid) throw new RpcException({ message: 'Invalid verification token', status: 400 });

    await this.prisma.user.update({
      where: { id: data.userId },
      data: { isTwoFactorEnabled: false, twoFactorSecret: null },
    });

    return { message: '2FA disabled successfully' };
  }

  async verify2faLogin(data: { userId: string; token: string; metadata: any }) {
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new RpcException({ message: '2FA not enabled', status: 400 });
    }

    const isValid = await this.verifyTotp(user.twoFactorSecret, data.token);
    if (!isValid) throw new RpcException({ message: 'Invalid 2FA token', status: 401 });

    // --- Session Creation (Duplicated logic from login for simplicity/consistency) ---
    const { deviceId, deviceName, deviceType, ipAddress, userAgent } = data.metadata || {};
    let device = await this.prisma.device.findUnique({
      where: { userId_deviceId: { userId: user.id, deviceId: deviceId || 'unknown' } },
    });

    if (!device || !device.isTrusted) {
        throw new RpcException({ message: 'Untrusted device', status: 403 });
    }

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        deviceId: device.id,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const payload = { sub: user.id, email: user.email, sid: session.id };
    const { password: _, ...userWithoutPassword } = user;
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-super-secret-change-me';

    return {
      access_token: await this.jwtService.signAsync(payload),
      refresh_token: await this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: '7d',
      }),
      user: userWithoutPassword,
      session: {
        id: session.id,
        deviceName: device.name,
        lastActiveAt: session.lastActiveAt,
      },
    };
  }

  async refreshToken(data: { refresh_token: string }) {
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-super-secret-change-me';

    let decoded: any;
    try {
      decoded = await this.jwtService.verifyAsync(data.refresh_token, { secret: refreshSecret });
    } catch {
      throw new RpcException({ message: 'Invalid or expired refresh token', status: 401 });
    }

    const userId: string = decoded.sub;
    const sessionId: string | undefined = decoded.sid;

    // If token carries a session ID, verify the session is still active
    if (sessionId) {
      const session = await this.prisma.session.findFirst({
        where: { id: sessionId, userId, isRevoked: false },
      });

      if (!session) {
        throw new RpcException({ message: 'Session has been revoked or expired', status: 401 });
      }

      if (session.expiresAt && session.expiresAt < new Date()) {
        throw new RpcException({ message: 'Session expired', status: 401 });
      }

      // Bump lastActiveAt
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { lastActiveAt: new Date() },
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new RpcException({ message: 'User not found', status: 404 });

    const payload = { sub: user.id, email: user.email, ...(sessionId ? { sid: sessionId } : {}) };
    const { password: _, ...userWithoutPassword } = user;

    return {
      access_token: await this.jwtService.signAsync(payload),
      refresh_token: await this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: '7d',
      }),
      user: userWithoutPassword,
    };
  }

  private async verifyTotp(secret: string, token: string): Promise<boolean> {
    // Basic TOTP implementation (Simplified for manual use without library)
    // Note: In production, a library like otplib is strictly recommended.
    // This uses a fixed 30s window check.
    const timeStep = 30;
    const counter = Math.floor(Date.now() / 1000 / timeStep);
    
    const checkToken = (c: number) => {
        const message = Buffer.alloc(8);
        message.writeBigInt64BE(BigInt(c), 0);
        const hmac = crypto.createHmac('sha1', secret);
        hmac.update(message);
        const hash = hmac.digest();
        const offset = hash[hash.length - 1] & 0xf;
        const binary = ((hash[offset] & 0x7f) << 24) |
                      ((hash[offset + 1] & 0xff) << 16) |
                      ((hash[offset + 2] & 0xff) << 8) |
                      (hash[offset + 3] & 0xff);
        return (binary % 1000000).toString().padStart(6, '0');
    };

    // Check current, previous, and next windows
    return checkToken(counter) === token || 
           checkToken(counter - 1) === token || 
           checkToken(counter + 1) === token;
  }
}
