import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
    message: string;
    details: string;
    errorGroup: string;
    data: T;
}

@Injectable()
export class ApiResponseInterceptor<T>
    implements NestInterceptor<T, Response<T>> {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<Response<T>> {
        return next.handle().pipe(
            map((data) => ({
                message: data?.message || 'Request successful',
                details: data?.details || '',
                errorGroup: '',
                data: data?.data !== undefined ? data.data : data,
            })),
        );
    }
}
