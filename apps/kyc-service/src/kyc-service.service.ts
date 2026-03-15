import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { DatabaseService } from '@app/database';
import { IdentityPassService, encrypt } from '@app/common';
import { OnboardingStep } from '@prisma/client';

@Injectable()
export class KycServiceService {
  private readonly logger = new Logger(KycServiceService.name);

  constructor(
    private readonly prisma: DatabaseService,
    private readonly identityPass: IdentityPassService,
  ) { }

  async verifyBvn(userId: string, bvn: string) {
    this.logger.log(`Starting BVN verification for user ${userId}`);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { kyc: true, profile: true },
    });

    if (!user) {
      this.logger.error(`User ${userId} not found during BVN verification`);
      throw new RpcException({ message: 'User not found', status: 404 });
    }

    const profile = user.profile;

    if (!profile || !profile.firstName || !profile.lastName) {
      this.logger.error(`User ${userId} has incomplete profile for BVN verification`);
      throw new RpcException({ message: 'User profile is incomplete. Please update your basic info first.', status: 400 });
    }


    // Call IdentityPass/Prembly
    try {
      this.logger.log(`Calling IdentityPass for BVN: ${bvn.substring(0, 3)}...`);
      const response: any = await this.identityPass.verifyBvn(bvn);
      this.logger.debug(`IdentityPass response: ${JSON.stringify(response)}`);

      /**
       * Prembly response codes:
       * 00: Success
       * 01: Record not found
       * 02: Unable to complete verification
       */
      if (response.response_code === '01') {
        this.logger.warn(`BVN verification: Record not found for ${userId}`);
        throw new RpcException({ message: 'Record not found for the provided BVN number', status: 400 });
      }

      if (response.response_code === '02') {
        this.logger.warn(`BVN verification: Unable to complete for ${userId}`);
        throw new RpcException({ message: 'Unable to complete verification at the moment', status: 400 });
      }

      if (response.response_code !== '00' || !response.status) {
        this.logger.error(`BVN verification failed for ${userId}: ${response.detail}`);
        throw new RpcException({ message: response.detail || 'BVN verification failed', status: 400 });
      }

      const bvnData = response.data;

      // Name comparison (case-insensitive)
      const firstNameMatch = (bvnData.firstName || bvnData.first_name || '').toLowerCase() === profile.firstName.toLowerCase();
      const lastNameMatch = (bvnData.lastName || bvnData.last_name || '').toLowerCase() === profile.lastName.toLowerCase();

      this.logger.log(`Name comparison for ${userId}: firstNameMatch=${firstNameMatch}, lastNameMatch=${lastNameMatch}`);

      if (!firstNameMatch || !lastNameMatch) {
        this.logger.warn(`Name mismatch for ${userId}. BVN: ${bvnData.firstName} ${bvnData.lastName}, Profile: ${profile.firstName} ${profile.lastName}`);
        throw new RpcException({ message: 'Names on BVN do not match your profile names', status: 400 });
      }

      // Encrypt the full response before storing
      const encryptedResponse = encrypt(JSON.stringify(response));

      await this.prisma.$transaction([
        this.prisma.kycRecord.upsert({
          where: { userId },
          create: {
            userId,
            bvn,
            bvnVerified: true,
            bvnResponse: encryptedResponse,
          },
          update: {
            bvn,
            bvnVerified: true,
            bvnResponse: encryptedResponse,
          },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: { currentStep: OnboardingStep.IDENTITY },
        }),
      ]);

      this.logger.log(`BVN verified successfully for user ${userId}`);

      return {
        message: 'BVN verified successfully',
        data: {
          nextStep: OnboardingStep.IDENTITY,
        },
      };

    } catch (error) {
      this.logger.error(`Catch block in verifyBvn for user ${userId}: ${error.message}`, error.stack);
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({ message: `BVN verification failed: ${error.message}`, status: 400 });
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
    const { userId, address, landmark, country, state, documentType, proofOfAddress } = data;

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
          addressLandmark: landmark,
          addressDocumentType: documentType,
          proofOfAddress,
        },
      }),
      this.prisma.profile.upsert({
        where: { userId },
        create: { userId, country, state },
        update: { country, state },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { currentStep: OnboardingStep.COMPLETED },
      }),
    ]);

    return { message: 'Address updated successfully', nextStep: OnboardingStep.COMPLETED };
  }
}
