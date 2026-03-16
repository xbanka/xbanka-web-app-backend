import { Test, TestingModule } from '@nestjs/testing';
import { PaystackService } from './paystack.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PaystackService', () => {
    let service: PaystackService;
    let mockAxiosInstance: any;

    beforeEach(async () => {
        process.env.PAYSTACK_SECRET_KEY = 'test_paystack_key';

        mockAxiosInstance = {
            create: jest.fn().mockReturnThis(),
            interceptors: {
                request: { use: jest.fn() },
                response: { use: jest.fn() },
            },
            get: jest.fn(),
            post: jest.fn(),
        };

        mockedAxios.create.mockReturnValue(mockAxiosInstance);

        const module: TestingModule = await Test.createTestingModule({
            providers: [PaystackService],
        }).compile();

        service = module.get<PaystackService>(PaystackService);
        (service as any).axios = mockAxiosInstance;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should call Paystack API to fetch banks', async () => {
        const mockBanks = {
            data: [
                { name: 'Access Bank', code: '044' },
                { name: 'GTBank', code: '058' },
            ],
        };
        mockAxiosInstance.get.mockResolvedValue({ data: mockBanks });

        const result = await service.getBanks();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith(
            'https://api.paystack.co/bank?country=nigeria',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer test_paystack_key',
                }),
            }),
        );
        expect(result).toEqual(mockBanks);
    });

    it('should handle errors when fetching banks', async () => {
        mockAxiosInstance.get.mockRejectedValue(new Error('API Error'));

        await expect(service.getBanks()).rejects.toThrow('API Error');
    });
});
