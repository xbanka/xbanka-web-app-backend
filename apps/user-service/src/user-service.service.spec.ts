import { Test, TestingModule } from '@nestjs/testing';
import { UserServiceService } from './user-service.service';
import { DatabaseService } from '@app/database';
import { RpcException } from '@nestjs/microservices';
import { OnboardingStep } from '@prisma/client';

describe('UserServiceService', () => {
    let service: UserServiceService;
    let prisma: DatabaseService;

    const mockPrisma = {
        user: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        profile: {
            upsert: jest.fn(),
        },
        $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserServiceService,
                { provide: DatabaseService, useValue: mockPrisma },
            ],
        }).compile();

        service = module.get<UserServiceService>(UserServiceService);
        prisma = module.get<DatabaseService>(DatabaseService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getProfile', () => {
        it('should throw RpcException if user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect(service.getProfile({ userId: '1' })).rejects.toThrow(RpcException);
        });

        it('should return user profile correctly', async () => {
            const mockUser = {
                id: '1',
                email: 'test@test.com',
                createdAt: new Date('2023-01-01'),
                profile: {
                    firstName: 'John',
                    lastName: 'Doe',
                    phoneNumber: '1234567890',
                    avatarUrl: 'http://pic.com/1.png'
                }
            };
            mockPrisma.user.findUnique.mockResolvedValue(mockUser);

            const result = await service.getProfile({ userId: '1' });
            expect(result).toEqual({
                userId: '1',
                email: 'test@test.com',
                firstName: 'John',
                lastName: 'Doe',
                phoneNumber: '1234567890',
                avatarUrl: 'http://pic.com/1.png',
                createdAt: mockUser.createdAt
            });
            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: '1' },
                include: { profile: true },
            });
        });
    });

    describe('updateProfile', () => {
        const profileData = {
            userId: '1',
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            phoneNumber: '1234567890',
            gender: 'Male',
            country: 'USA',
        };

        it('should throw RpcException if user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect(service.updateProfile(profileData)).rejects.toThrow(RpcException);
        });

        it('should update profile and onboarding step', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: '1' });

            const result = await service.updateProfile(profileData);

            expect(result.message).toBe('Profile updated successfully');
            expect(result.nextStep).toBe(OnboardingStep.BVN);
            expect(mockPrisma.profile.upsert).toHaveBeenCalled();
            expect(mockPrisma.user.update).toHaveBeenCalledWith({
                where: { id: profileData.userId },
                data: { currentStep: OnboardingStep.BVN },
            });
        });

        it('should update profile with avatarUrl', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: '1' });

            const result = await service.updateProfile({ ...profileData, avatarUrl: 'url' });

            expect(result.message).toBe('Profile updated successfully');
            expect(mockPrisma.profile.upsert).toHaveBeenCalledWith(expect.objectContaining({
                create: expect.objectContaining({ avatarUrl: 'url' }),
                update: expect.objectContaining({ avatarUrl: 'url' }),
            }));
        });
    });

    describe('skipStep', () => {
        it('should throw RpcException if user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect(service.skipStep('1')).rejects.toThrow(RpcException);
        });

        it('should move to next onboarding step', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: '1', currentStep: OnboardingStep.SIGNUP });

            const result = await service.skipStep('1');

            expect(result.message).toBe('Step skipped');
            expect(result.nextStep).toBe(OnboardingStep.EMAIL_VERIFIED);
            expect(mockPrisma.user.update).toHaveBeenCalledWith({
                where: { id: '1' },
                data: { currentStep: OnboardingStep.EMAIL_VERIFIED },
            });
        });

        it('should stay at COMPLETED if already completed', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: '1', currentStep: OnboardingStep.COMPLETED });

            const result = await service.skipStep('1');

            expect(result.nextStep).toBe(OnboardingStep.COMPLETED);
        });
    });
});
