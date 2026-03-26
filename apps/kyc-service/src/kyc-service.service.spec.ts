import { Test, TestingModule } from '@nestjs/testing';
import { KycServiceService } from './kyc-service.service';
import { DatabaseService } from '@app/database';
import { IdentityPassService } from '@app/common';
import { RpcException } from '@nestjs/microservices';
import { OnboardingStep } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('KycServiceService', () => {
    let service: KycServiceService;
    let prisma: DatabaseService;
    let identityPass: IdentityPassService;

    const mockPrisma = {
        user: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        kycRecord: {
            upsert: jest.fn(),
            update: jest.fn(),
        },
        profile: {
            upsert: jest.fn(),
        },
        $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    const mockIdentityPass = {
        verifyBvn: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                KycServiceService,
                { provide: DatabaseService, useValue: mockPrisma },
                { provide: IdentityPassService, useValue: mockIdentityPass },
            ],
        }).compile();

        service = module.get<KycServiceService>(KycServiceService);
        prisma = module.get<DatabaseService>(DatabaseService);
        identityPass = module.get<IdentityPassService>(IdentityPassService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('verifyBvn', () => {
        const userId = '1';
        const bvn = '12345678901';

        it('should throw RpcException if user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect(service.verifyBvn(userId, bvn)).rejects.toThrow(RpcException);
        });

        it('should verify BVN and update onboarding step', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: userId,
                currentStep: OnboardingStep.BASIC_INFO,
                profile: { firstName: 'John', lastName: 'Doe' }
            });
            mockIdentityPass.verifyBvn.mockResolvedValue({
                status: true,
                response_code: '00',
                data: { firstName: 'John', lastName: 'Doe' }
            });

            const result = await service.verifyBvn(userId, bvn);

            expect(result.message).toBe('BVN verified successfully');
            expect(result.data.nextStep).toBe(OnboardingStep.IDENTITY);
            expect(mockPrisma.kycRecord.upsert).toHaveBeenCalled();
            expect(mockPrisma.user.update).toHaveBeenCalledWith({
                where: { id: userId },
                data: { currentStep: OnboardingStep.IDENTITY },
            });
        });

        it('should throw RpcException if identityPass fails', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: userId,
                currentStep: OnboardingStep.BASIC_INFO,
                profile: { firstName: 'John', lastName: 'Doe' }
            });
            mockIdentityPass.verifyBvn.mockRejectedValue(new Error('Invalid BVN'));

            await expect(service.verifyBvn(userId, bvn)).rejects.toThrow(RpcException);
        });
    });

    describe('updateIdentity', () => {
        const data = { userId: '1', idType: 'PASSPORT', idNumber: 'A123', idImageUrl: 'url' };

        it('should update identity and move to SELFIE step', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: '1' });
            const result = await service.updateIdentity(data);
            expect(result.nextStep).toBe(OnboardingStep.SELFIE);
            expect(mockPrisma.kycRecord.upsert).toHaveBeenCalled();
        });
    });

    describe('updateSelfie', () => {
        const data = { userId: '1', selfieUrl: 'url' };

        it('should update selfie and move to ADDRESS step', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: '1' });
            const result = await service.updateSelfie(data);
            expect(result.nextStep).toBe(OnboardingStep.ADDRESS);
            expect(mockPrisma.kycRecord.update).toHaveBeenCalled();
        });
    });

    describe('updateAddress', () => {
        const data = { userId: '1', address: '123 St', country: 'NG', state: 'Lagos', proofOfAddress: 'url' };

        it('should update address and move to COMPLETED step', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: '1' });
            const result = await service.updateAddress(data);
            expect(result.nextStep).toBe(OnboardingStep.COMPLETED);
            expect(mockPrisma.kycRecord.update).toHaveBeenCalled();
            expect(mockPrisma.profile.upsert).toHaveBeenCalled();
        });
    });

    describe('getOnboardingProgress', () => {
        const userId = '1';

        it('should return correct progress for IDENTITY step', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: userId, currentStep: OnboardingStep.IDENTITY });

            const result = await service.getOnboardingProgress(userId);

            expect(result.currentStep).toBe(OnboardingStep.IDENTITY);
            expect(result.progress).toHaveLength(7);

            // SIGNUP (index 0)
            expect(result.progress[0]).toMatchObject({ id: OnboardingStep.SIGNUP, status: 'completed', isCompleted: true });
            // EMAIL_VERIFIED (index 1)
            expect(result.progress[1]).toMatchObject({ id: OnboardingStep.EMAIL_VERIFIED, status: 'completed', isCompleted: true });
            // BASIC_INFO (index 2)
            expect(result.progress[2]).toMatchObject({ id: OnboardingStep.BASIC_INFO, status: 'completed', isCompleted: true });
            // BVN (index 3)
            expect(result.progress[3]).toMatchObject({ id: OnboardingStep.BVN, status: 'completed', isCompleted: true });
            // IDENTITY (index 4)
            expect(result.progress[4]).toMatchObject({ id: OnboardingStep.IDENTITY, status: 'current', isCompleted: false });
            // SELFIE (index 5)
            expect(result.progress[5]).toMatchObject({ id: OnboardingStep.SELFIE, status: 'pending', isCompleted: false });
            // ADDRESS (index 6)
            expect(result.progress[6]).toMatchObject({ id: OnboardingStep.ADDRESS, status: 'pending', isCompleted: false });
        });

        it('should return all completed when currentStep is COMPLETED', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: userId, currentStep: OnboardingStep.COMPLETED });

            const result = await service.getOnboardingProgress(userId);

            result.progress.forEach(step => {
                expect(step.status).toBe('completed');
                expect(step.isCompleted).toBe(true);
            });
        });

        it('should return correct dynamic statuses for Tier 2', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: userId,
                currentStep: OnboardingStep.IDENTITY,
                isEmailVerified: true,
                profile: { phoneNumber: '+123456789' },
                kyc: { bvnVerified: true, idStatus: 'VERIFIED', addressStatus: 'PENDING' }
            });

            const result = await service.getOnboardingProgress(userId);

            expect(result.emailVerified).toBe(true);
            expect(result.phoneVerified).toBe(true);
            expect(result.kycStatus).toBe('PENDING');
            expect(result.tierLevel).toBe(2);
        });

        it('should return correct dynamic statuses for Tier 3', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: userId,
                currentStep: OnboardingStep.COMPLETED,
                isEmailVerified: true,
                profile: { phoneNumber: '+123456789' },
                kyc: { bvnVerified: true, idStatus: 'VERIFIED', addressStatus: 'VERIFIED' }
            });

            const result = await service.getOnboardingProgress(userId);

            expect(result.kycStatus).toBe('VERIFIED');
            expect(result.tierLevel).toBe(3);
        });

        it('should throw error if user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect(service.getOnboardingProgress(userId)).rejects.toThrow(RpcException);
        });
    });
});
