import { Test, TestingModule } from '@nestjs/testing';
import { AuthServiceController } from './auth-service.controller';
import { AuthServiceService } from './auth-service.service';

describe('AuthServiceController', () => {
  let authServiceController: AuthServiceController;
  let authServiceService: AuthServiceService;

  const mockAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
    verifyEmail: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AuthServiceController],
      providers: [
        { provide: AuthServiceService, useValue: mockAuthService },
      ],
    }).compile();

    authServiceController = app.get<AuthServiceController>(AuthServiceController);
    authServiceService = app.get<AuthServiceService>(AuthServiceService);
  });

  it('should be defined', () => {
    expect(authServiceController).toBeDefined();
  });

  it('should call signup', async () => {
    const data = { email: 'test@test.com', password: 'password' };
    await authServiceController.signup(data);
    expect(authServiceService.signup).toHaveBeenCalledWith(data);
  });

  it('should call login', async () => {
    const data = { email: 'test@test.com', password: 'password' };
    await authServiceController.login(data);
    expect(authServiceService.login).toHaveBeenCalledWith(data);
  });

  it('should call verifyEmail', async () => {
    const data = { email: 'test@test.com' };
    await authServiceController.verifyEmail(data);
    expect(authServiceService.verifyEmail).toHaveBeenCalledWith(data.email);
  });
});
