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
