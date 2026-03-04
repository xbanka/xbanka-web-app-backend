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
            create: jest.fn(),
            update: jest.fn(),
        },
    };

    const mockJwtService = {
        signAsync: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthServiceService,
                { provide: DatabaseService, useValue: mockPrisma },
                { provide: JwtService, useValue: mockJwtService },
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
        };

        it('should throw RpcException if user already exists', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: signupData.email });

            await expect(service.signup(signupData)).rejects.toThrow(RpcException);
            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: signupData.email } });
        });

        it('should hash password and create user', async () => {
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
        const email = 'test@example.com';

        it('should update user and mark email as verified', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email });
            mockPrisma.user.update.mockResolvedValue({
                id: '1',
                email,
                isEmailVerified: true,
                currentStep: OnboardingStep.EMAIL_VERIFIED,
            });

            const result = await service.verifyEmail(email);

            expect(result.isEmailVerified).toBe(true);
            expect(result.currentStep).toBe(OnboardingStep.EMAIL_VERIFIED);
            expect(mockPrisma.user.update).toHaveBeenCalledWith({
                where: { email },
                data: {
                    isEmailVerified: true,
                    currentStep: OnboardingStep.EMAIL_VERIFIED,
                },
            });
        });

        it('should throw RpcException if user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            await expect(service.verifyEmail(email)).rejects.toThrow(RpcException);
        });
    });
});
