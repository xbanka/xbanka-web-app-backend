import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const internalKey = request.headers['x-internal-key'];

    if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
      throw new UnauthorizedException('Invalid or missing internal API key');
    }

    return true;
  }
}
