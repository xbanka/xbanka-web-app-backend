import { Test, TestingModule } from '@nestjs/testing';
import { AuthServiceService } from './auth-service.service';
import { DatabaseService } from '@app/database';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { OnboardingStep } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('AuthServiceService', () => {
    let service: AuthServiceService;
    let prisma: DatabaseService;
    let jwtService: JwtService;

    const mockPrisma = {
        user: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
    };

    const mockJwtService = {
        signAsync: jest.fn(),
    };

    const mockNotificationClient = {
        emit: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthServiceService,
                { provide: DatabaseService, useValue: mockPrisma },
                { provide: JwtService, useValue: mockJwtService },
                { provide: 'NOTIFICATION_SERVICE', useValue: mockNotificationClient },
            ],
        }).compile();

        service = module.get<AuthServiceService>(AuthServiceService);
        prisma = module.get<DatabaseService>(DatabaseService);
        jwtService = module.get<JwtService>(JwtService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('signup', () => {
        const signupData = {
            email: 'test@example.com',
            password: 'password123',
            redirectUrl: 'http://localhost:3000/verify',
        };

        it('should throw RpcException if user already exists', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: signupData.email });

            await expect(service.signup(signupData)).rejects.toThrow(RpcException);
            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: signupData.email } });
        });

        it('should hash password and create user and emit email event', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            mockPrisma.user.create.mockResolvedValue({
                id: '1',
                email: signupData.email,
                password: 'hashedPassword',
                referralCode: 'abc',
                currentStep: OnboardingStep.SIGNUP,
            });

            const result = await service.signup(signupData);

            expect(result).not.toHaveProperty('password');
            expect(result.email).toBe(signupData.email);
            expect(mockPrisma.user.create).toHaveBeenCalled();
            expect(mockNotificationClient.emit).toHaveBeenCalledWith('send_email', expect.objectContaining({
                to: signupData.email,
                subject: expect.stringContaining('Welcome'),
            }));
        });
    });

    describe('login', () => {
        const loginData = {
            email: 'test@example.com',
            password: 'password123',
            deviceId: 'test-device',
        };

        it('should throw 401 if user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            await expect(service.login(loginData)).rejects.toThrow(RpcException);
        });

        it('should throw 401 if password is invalid', async () => {
            const hashedPassword = await bcrypt.hash('differentPassword', 10);
            mockPrisma.user.findUnique.mockResolvedValue({
                id: '1',
                email: loginData.email,
                password: hashedPassword,
            });

            await expect(service.login(loginData)).rejects.toThrow(RpcException);
        });

        it('should return access token and user info on success', async () => {
            const hashedPassword = await bcrypt.hash(loginData.password, 10);
            const user = {
                id: '1',
                email: loginData.email,
                password: hashedPassword,
            };
            mockPrisma.user.findUnique.mockResolvedValue(user);
            // Fix: device must be defined for session creation logic
            (mockPrisma as any).device = { 
                findUnique: jest.fn().mockResolvedValue({ id: 'd1', isTrusted: true, deviceId: 'test-device' }),
                create: jest.fn().mockResolvedValue({ id: 'd1', name: 'device' }),
                update: jest.fn().mockResolvedValue({ id: 'd1' }),
            };
            (mockPrisma as any).session = {
                create: jest.fn().mockResolvedValue({ id: 's1', lastActiveAt: new Date() }),
            };
            
            mockJwtService.signAsync.mockResolvedValue('test_token');

            const result = await service.login({
                email: 'test@example.com',
                password: 'password123',
                metadata: { deviceId: 'test-device' }
            });

            expect(result).toHaveProperty('access_token', 'test_token');
            expect(result.user).not.toHaveProperty('password');
            // expect(result.user.email).toBe('test@example.com');
        });
    });

    describe('verifyEmail', () => {
        const token = 'test-token';

        it('should update user and mark email as verified', async () => {
            const user = { id: '1', email: 'test@example.com', verificationToken: token };
            mockPrisma.user.findFirst.mockResolvedValue(user);
            mockPrisma.user.update.mockResolvedValue({
                ...user,
                isEmailVerified: true,
                currentStep: OnboardingStep.EMAIL_VERIFIED,
            });

            const result = await service.verifyEmail(token);

            expect(result.isEmailVerified).toBe(true);
            expect(result.currentStep).toBe(OnboardingStep.EMAIL_VERIFIED);
            expect(mockPrisma.user.update).toHaveBeenCalledWith({
                where: { id: user.id },
                data: expect.objectContaining({
                    isEmailVerified: true,
                    currentStep: OnboardingStep.EMAIL_VERIFIED,
                }),
            });
        });

        it('should throw RpcException if token not found', async () => {
            mockPrisma.user.findFirst.mockResolvedValue(null);

            await expect(service.verifyEmail(token)).rejects.toThrow(RpcException);
        });
    });

    describe('Security Features', () => {
        const userId = 'user-1';
        const otp = '123456';

        describe('requestSecurityOtp', () => {
            it('should generate and send OTP', async () => {
                mockPrisma.user.findUnique.mockResolvedValue({ id: userId, email: 'test@test.com' });
                const result = await service.requestSecurityOtp(userId);
                expect(result.message).toContain('OTP sent');
                expect(mockPrisma.user.update).toHaveBeenCalled();
                expect(mockNotificationClient.emit).toHaveBeenCalled();
            });
        });

        describe('changePassword', () => {
            it('should change password with valid OTP and old password', async () => {
                const oldPass = 'oldPassword';
                const newPass = 'newPassword';
                const hashedOld = await bcrypt.hash(oldPass, 10);
                
                mockPrisma.user.findUnique.mockResolvedValue({ 
                    id: userId, 
                    password: hashedOld, 
                    securityOtp: otp,
                    securityOtpExpiresAt: new Date(Date.now() + 10000)
                });

                const result = await service.changePassword({ userId, oldPassword: oldPass, newPassword: newPass, otp });
                expect(result.message).toContain('successfully');
                expect(mockPrisma.user.update).toHaveBeenCalled();
            });

            it('should throw if OTP is invalid', async () => {
                mockPrisma.user.findUnique.mockResolvedValue({ id: userId, securityOtp: 'wrong' });
                await expect(service.changePassword({ userId, otp, oldPassword: 'a', newPassword: 'b' }))
                    .rejects.toThrow(RpcException);
            });
        });

        describe('Transaction PIN', () => {
            it('should create PIN with valid OTP', async () => {
                mockPrisma.user.findUnique.mockResolvedValue({ 
                    id: userId, 
                    securityOtp: otp,
                    securityOtpExpiresAt: new Date(Date.now() + 10000)
                });

                const result = await service.createPin({ userId, pin: '1234', otp });
                expect(result.message).toContain('created');
                expect(mockPrisma.user.update).toHaveBeenCalled();
            });
        });

        describe('2FA (TOTP)', () => {
            it('should generate a secret', async () => {
                mockPrisma.user.findUnique.mockResolvedValue({ id: userId, email: 'test@test.com' });
                const result = await service.generate2faSecret(userId);
                expect(result).toHaveProperty('secret');
                expect(result).toHaveProperty('otpAuthUrl');
                expect(result.otpAuthUrl).toContain('test@test.com');
            });
        });
    });
});
