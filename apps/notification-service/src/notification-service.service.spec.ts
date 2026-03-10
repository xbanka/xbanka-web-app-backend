import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationServiceService } from './notification-service.service';
import { Resend } from 'resend';

jest.mock('resend');

describe('NotificationServiceService', () => {
    let service: NotificationServiceService;
    let configService: ConfigService;
    let resendMock: any;

    beforeEach(async () => {
        resendMock = {
            emails: {
                send: jest.fn(),
            },
        };
        (Resend as jest.Mock).mockImplementation(() => resendMock);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationServiceService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockReturnValue('re_test_key'),
                    },
                },
            ],
        }).compile();

        service = module.get<NotificationServiceService>(NotificationServiceService);
        configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('sendEmail', () => {
        it('should send an email successfully', async () => {
            resendMock.emails.send.mockResolvedValue({ data: { id: 'test_id' }, error: null });

            const result = await service.sendEmail('test@example.com', 'Test Subject', '<h1>Hello</h1>');

            expect(result).toBe(true);
            expect(resendMock.emails.send).toHaveBeenCalledWith({
                from: 'Xbanka <notifications@xbankang.com>',
                to: ['test@example.com'],
                subject: 'Test Subject',
                html: '<h1>Hello</h1>',
            });
        });

        it('should return false if Resend returns an error', async () => {
            resendMock.emails.send.mockResolvedValue({ data: null, error: { message: 'Api Error' } });

            const result = await service.sendEmail('test@example.com', 'Test Subject', '<h1>Hello</h1>');

            expect(result).toBe(false);
        });

        it('should return false if an exception occurs', async () => {
            resendMock.emails.send.mockRejectedValue(new Error('Network Error'));

            const result = await service.sendEmail('test@example.com', 'Test Subject', '<h1>Hello</h1>');

            expect(result).toBe(false);
        });
    });
});
