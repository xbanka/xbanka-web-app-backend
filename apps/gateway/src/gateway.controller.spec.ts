import { Test, TestingModule } from '@nestjs/testing';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';

describe('GatewayController', () => {
  let gatewayController: GatewayController;
  let authClient: any;

  const mockClientProxy = {
    send: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [GatewayController],
      providers: [
        GatewayService,
        { provide: 'AUTH_SERVICE', useValue: mockClientProxy },
        { provide: 'USER_SERVICE', useValue: mockClientProxy },
        { provide: 'KYC_SERVICE', useValue: mockClientProxy },
      ],
    }).compile();

    gatewayController = app.get<GatewayController>(GatewayController);
    authClient = app.get('AUTH_SERVICE');
  });

  it('should be defined', () => {
    expect(gatewayController).toBeDefined();
  });

  it('should proxy signup to auth service', () => {
    const signupData = { email: 'a@b.com', password: 'password' };
    gatewayController.signup(signupData);
    expect(authClient.send).toHaveBeenCalledWith({ cmd: 'signup' }, signupData);
  });
});
