import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || 'super-secret-key-change-me',
        });
    }

    async validate(payload: any) {
        // Validation: check if the session is still active
        if (payload.sid) {
            const isValid = await firstValueFrom(
                this.authClient.send({ cmd: 'validate-session' }, { sessionId: payload.sid, userId: payload.sub })
            );
            if (!isValid) {
                throw new UnauthorizedException('Session has been revoked or expired');
            }
        }

        return { id: payload.sub, email: payload.email, sessionId: payload.sid };
    }
}
