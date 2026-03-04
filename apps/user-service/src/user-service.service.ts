import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { DatabaseService } from '@app/database';
import { OnboardingStep } from '@prisma/client';

@Injectable()
export class UserServiceService {
  constructor(private readonly prisma: DatabaseService) { }

  async updateProfile(data: any) {
    const { userId, firstName, lastName, dateOfBirth, phoneNumber, gender, country } = data;

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
        },
        update: {
          firstName,
          lastName,
          dateOfBirth: new Date(dateOfBirth),
          phoneNumber,
          gender,
          country,
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
