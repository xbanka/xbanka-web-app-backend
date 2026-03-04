import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { DatabaseService } from '@app/database';
import { IdentityPassService } from '@app/common';
import { OnboardingStep } from '@prisma/client';

@Injectable()
export class KycServiceService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly identityPass: IdentityPassService,
  ) { }

  async verifyBvn(userId: string, bvn: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { kyc: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.currentStep !== OnboardingStep.BASIC_INFO && user.currentStep !== OnboardingStep.BVN) {
      // Allow re-verification if at BVN stage or just finished Basic Info
    }

    // Call IdentityPass/Prembly
    try {
      const verificationResult: any = await this.identityPass.verifyBvn(bvn);

      // In a real scenario, we'd validate the result data against user profile
      // For now, we'll mark as verified if the API call succeeds

      await this.prisma.$transaction([
        this.prisma.kycRecord.upsert({
          where: { userId },
          create: {
            userId,
            bvn,
            bvnVerified: true,
          },
          update: {
            bvn,
            bvnVerified: true,
          },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: { currentStep: OnboardingStep.IDENTITY },
        }),
      ]);

      return {
        message: 'BVN verified successfully',
        data: {
          verificationResult,
          nextStep: OnboardingStep.IDENTITY,
        },
      };

    } catch (error) {
      throw new BadRequestException(`BVN verification failed: ${error.message}`);
    }
  }

  async updateIdentity(data: any) {
    const { userId, idType, idNumber, idImageUrl } = data;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new RpcException({ message: 'User not found', status: 404 });
    }

    await this.prisma.$transaction([
      this.prisma.kycRecord.upsert({
        where: { userId },
        create: {
          userId,
          idType,
          idNumber,
          idImageUrl,
        },
        update: {
          idType,
          idNumber,
          idImageUrl,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { currentStep: OnboardingStep.SELFIE },
      }),
    ]);

    return { message: 'Identity updated successfully', nextStep: OnboardingStep.SELFIE };
  }

  async updateSelfie(data: any) {
    const { userId, selfieUrl } = data;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new RpcException({ message: 'User not found', status: 404 });
    }

    await this.prisma.$transaction([
      this.prisma.kycRecord.update({
        where: { userId },
        data: { selfieUrl },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { currentStep: OnboardingStep.ADDRESS },
      }),
    ]);

    return { message: 'Selfie updated successfully', nextStep: OnboardingStep.ADDRESS };
  }

  async updateAddress(data: any) {
    const { userId, address, proofOfAddress } = data;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new RpcException({ message: 'User not found', status: 404 });
    }

    await this.prisma.$transaction([
      this.prisma.kycRecord.update({
        where: { userId },
        data: {
          address,
          proofOfAddress,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { currentStep: OnboardingStep.COMPLETED },
      }),
    ]);

    return { message: 'Address updated successfully', nextStep: OnboardingStep.COMPLETED };
  }
}
