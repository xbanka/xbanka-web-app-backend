import { Test, TestingModule } from '@nestjs/testing';
import { KycServiceController } from './kyc-service.controller';
import { KycServiceService } from './kyc-service.service';

describe('KycServiceController', () => {
  let kycServiceController: KycServiceController;
  let kycServiceService: KycServiceService;

  const mockKycService = {
    verifyBvn: jest.fn(),
    updateIdentity: jest.fn(),
    updateSelfie: jest.fn(),
    updateAddress: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [KycServiceController],
      providers: [
        { provide: KycServiceService, useValue: mockKycService },
      ],
    }).compile();

    kycServiceController = app.get<KycServiceController>(KycServiceController);
    kycServiceService = app.get<KycServiceService>(KycServiceService);
  });

  it('should be defined', () => {
    expect(kycServiceController).toBeDefined();
  });

  it('should call verifyBvn', async () => {
    const data = { userId: '1', bvn: '123' };
    await kycServiceController.verifyBvn(data);
    expect(kycServiceService.verifyBvn).toHaveBeenCalledWith(data.userId, data.bvn);
  });

  it('should call updateIdentity', async () => {
    const data = { userId: '1', idType: 'PASSPORT' };
    await kycServiceController.updateIdentity(data);
    expect(kycServiceService.updateIdentity).toHaveBeenCalledWith(data);
  });

  it('should call updateSelfie', async () => {
    const data = { userId: '1', selfieUrl: 'url' };
    await kycServiceController.updateSelfie(data);
    expect(kycServiceService.updateSelfie).toHaveBeenCalledWith(data);
  });

  it('should call updateAddress', async () => {
    const data = { userId: '1', address: '123' };
    await kycServiceController.updateAddress(data);
    expect(kycServiceService.updateAddress).toHaveBeenCalledWith(data);
  });
});
