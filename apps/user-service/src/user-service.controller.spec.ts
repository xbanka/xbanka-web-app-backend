import { Test, TestingModule } from '@nestjs/testing';
import { UserServiceController } from './user-service.controller';
import { UserServiceService } from './user-service.service';

describe('UserServiceController', () => {
  let userServiceController: UserServiceController;
  let userServiceService: UserServiceService;

  const mockUserService = {
    updateProfile: jest.fn(),
    skipStep: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [UserServiceController],
      providers: [
        { provide: UserServiceService, useValue: mockUserService },
      ],
    }).compile();

    userServiceController = app.get<UserServiceController>(UserServiceController);
    userServiceService = app.get<UserServiceService>(UserServiceService);
  });

  it('should be defined', () => {
    expect(userServiceController).toBeDefined();
  });

  it('should call updateProfile', async () => {
    const data = { userId: '1', firstName: 'John' };
    await userServiceController.updateProfile(data);
    expect(userServiceService.updateProfile).toHaveBeenCalledWith(data);
  });

  it('should call skipStep', async () => {
    const data = { userId: '1' };
    await userServiceController.skipStep(data);
    expect(userServiceService.skipStep).toHaveBeenCalledWith(data.userId);
  });
});
