import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let details = '';
        let errorGroup = 'SERVER_ERROR';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse() as any;
            message = typeof res === 'string' ? res : res.message || exception.message;
            details = res.error || '';
            errorGroup = 'HTTP_ERROR';
        } else if (exception.status && typeof exception.status === 'number' && exception.status >= 100 && exception.status < 600) {
            // Handle RpcException with status
            status = exception.status;
            message = exception.message || message;
            details = exception.details || '';
            errorGroup = 'MICROSERVICE_ERROR';
        } else {
            details = exception.message || '';
        }

        response.status(status).json({
            message,
            details,
            errorGroup,
            data: null,
        });
    }
}
