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
            mockJwtService.signAsync.mockResolvedValue('test_token');

            const result = await service.login(loginData);

            expect(result).toHaveProperty('access_token', 'test_token');
            expect(result.user).not.toHaveProperty('password');
            expect(result.user.email).toBe(loginData.email);
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
});
