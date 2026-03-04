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

        it('should throw NotFoundException if user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect(service.verifyBvn(userId, bvn)).rejects.toThrow(NotFoundException);
        });

        it('should verify BVN and update onboarding step', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: userId, currentStep: OnboardingStep.BASIC_INFO });
            mockIdentityPass.verifyBvn.mockResolvedValue({ status: true });

            const result = await service.verifyBvn(userId, bvn);

            expect(result.message).toBe('BVN verified successfully');
            expect(result.data.nextStep).toBe(OnboardingStep.IDENTITY);
            expect(mockPrisma.kycRecord.upsert).toHaveBeenCalled();
            expect(mockPrisma.user.update).toHaveBeenCalledWith({
                where: { id: userId },
                data: { currentStep: OnboardingStep.IDENTITY },
            });
        });

        it('should throw BadRequestException if identityPass fails', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: userId, currentStep: OnboardingStep.BASIC_INFO });
            mockIdentityPass.verifyBvn.mockRejectedValue(new Error('Invalid BVN'));

            await expect(service.verifyBvn(userId, bvn)).rejects.toThrow(BadRequestException);
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
        const data = { userId: '1', address: '123 St', proofOfAddress: 'url' };

        it('should update address and move to COMPLETED step', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: '1' });
            const result = await service.updateAddress(data);
            expect(result.nextStep).toBe(OnboardingStep.COMPLETED);
            expect(mockPrisma.kycRecord.update).toHaveBeenCalled();
        });
    });
});
