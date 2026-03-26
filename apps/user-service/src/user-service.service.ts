import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { DatabaseService } from '@app/database';
import { OnboardingStep } from '@prisma/client';

@Injectable()
export class UserServiceService {
  constructor(private readonly prisma: DatabaseService) { }

  async getProfile(data: { userId: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      include: { profile: true },
    });

    if (!user) {
      throw new RpcException({ message: 'User not found', status: 404 });
    }

    return {
      userId: user.id,
      email: user.email,
      firstName: user.profile?.firstName || null,
      lastName: user.profile?.lastName || null,
      phoneNumber: user.profile?.phoneNumber || null,
      avatarUrl: user.profile?.avatarUrl || null,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(data: any) {
    const { userId, firstName, lastName, dateOfBirth, phoneNumber, gender, country, avatarUrl } = data;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new RpcException({ message: 'User not found', status: 404 });
    }

    await this.prisma.$transaction([
      this.prisma.profile.upsert({
        where: { userId },
        create: {
          userId,
          firstName,
          lastName,
          dateOfBirth: new Date(dateOfBirth),
          phoneNumber,
          gender,
          country,
          ...(avatarUrl && { avatarUrl }),
        },
        update: {
          firstName,
          lastName,
          dateOfBirth: new Date(dateOfBirth),
          phoneNumber,
          gender,
          country,
          ...(avatarUrl && { avatarUrl }),
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { currentStep: OnboardingStep.BVN },
      }),
    ]);

    return { message: 'Profile updated successfully', nextStep: OnboardingStep.BVN };
  }

  async skipStep(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new RpcException({ message: 'User not found', status: 404 });
    }

    const steps = Object.values(OnboardingStep);
    const currentIndex = steps.indexOf(user.currentStep);
    const nextStep = steps[currentIndex + 1] || OnboardingStep.COMPLETED;

    await this.prisma.user.update({
      where: { id: userId },
      data: { currentStep: nextStep },
    });

    return { message: 'Step skipped', nextStep };
  }
}
