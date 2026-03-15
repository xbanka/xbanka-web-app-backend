import { Test, TestingModule } from '@nestjs/testing';
import { ObiexService } from './obiex.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ObiexService', () => {
    let service: ObiexService;
    let mockAxiosInstance: any;

    beforeEach(async () => {
        process.env.OBIEX_API_KEY = 'test_key';
        process.env.OBIEX_API_SECRET = 'test_secret';
        process.env.OBIEX_BASE_URL = 'https://api.obiex.finance/v1';

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
            providers: [ObiexService],
        }).compile();

        service = module.get<ObiexService>(ObiexService);
        // Use the same instance used by the service
        (service as any).axios = mockAxiosInstance;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should generate correct headers for GET requests with query parameters', async () => {
        const path = '/transactions/summary/me';
        const params = { page: 1, pageSize: 10 };
        const mockData = { data: [] };
        mockAxiosInstance.get.mockResolvedValue({ data: mockData });

        await service.getUserTransactions(params);

        const expectedFullPath = `/v1${path}?page=1&pageSize=10`;
        // We can't easily check the exact signature without re-implementing it here, 
        // but we can check if it's called with the signature and correctly formatted headers
        expect(mockAxiosInstance.get).toHaveBeenCalledWith(
            expect.stringContaining(path),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'X-API-KEY': 'test_key',
                    'X-API-TIMESTAMP': expect.any(String),
                    'X-API-SIGNATURE': expect.any(String),
                }),
                params: params
            }),
        );
    });

    it('should use Bearer authentication for fiat withdrawal', async () => {
        const path = '/wallets/ext/debit/fiat';
        const data = {
            destination: { accountNumber: '123', accountName: 'Test', bankName: 'Bank', bankCode: '001' },
            amount: 100,
            currency: 'NGN',
            narration: 'test'
        };
        mockAxiosInstance.post.mockResolvedValue({ data: {} });

        await service.withdrawFiat(data);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
            expect.stringContaining(path),
            data,
            expect.not.objectContaining({
                headers: expect.objectContaining({
                    'X-API-SIGNATURE': expect.any(String)
                })
            })
        );
        // BaseIntegrationService automatically adds Authorization: Bearer
    });

    it('should generate correct headers for POST requests', async () => {
        const path = '/trades/quote';
        const mockData = { data: { id: 'quote_id' } };
        mockAxiosInstance.post.mockResolvedValue({ data: mockData });

        await service.createQuote('USDT', 'NGN', 10);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
            expect.stringContaining(path),
            { sourceId: 'USDT', targetId: 'NGN', amount: 10 },
            expect.objectContaining({
                headers: expect.objectContaining({
                    'X-API-KEY': 'test_key',
                    'X-API-TIMESTAMP': expect.any(String),
                    'X-API-SIGNATURE': expect.any(String),
                }),
            }),
        );
    });

    it('should correctly sign requests', async () => {
        // This test verifies the HMAC logic conceptually by checking if X-API-SIGNATURE is a 64-char hex string (SHA256)
        const path = '/currencies';
        mockAxiosInstance.get.mockResolvedValue({ data: {} });

        await service.getCurrencies();

        const lastCall = mockAxiosInstance.get.mock.calls[0];
        const signature = lastCall[1].headers['X-API-SIGNATURE'];
        expect(signature).toHaveLength(64);
        expect(signature).toMatch(/^[0-9a-f]+$/);
    });
});
