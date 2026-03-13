import { Injectable, ExecutionContext, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
    getAuthenticateOptions(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest();
        const redirectUrl = request.query.redirect_url || request.query.state;

        if (!redirectUrl) {
            throw new BadRequestException('redirect_url query parameter is required');
        }

        return {
            state: redirectUrl,
        };
    }
}
