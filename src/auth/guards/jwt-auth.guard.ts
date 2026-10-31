import {CanActivate, ExecutionContext,Injectable, UnauthorizedException, } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUser } from '../../common/types/auth-user';
import  { JwtPayload } from '../types/jwt-payload';

export interface AuthenticatedRequest extends Request {
    user: AuthUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;
    const parts = authorization?.trim().split(/\s+/);

    if (
      parts?.length !== 2 ||
      parts[0].toLowerCase() !== 'bearer' ||
      !parts[1]
    ) {
      throw new UnauthorizedException('Invalid or missing token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        parts[1],
      );

      if (
        typeof payload.sub !== 'string' ||
        !payload.sub ||
        !['USER', 'ADMIN'].includes(payload.role) ||
        typeof payload.jti !== 'string' ||
        !payload.jti ||
        !Number.isInteger(payload.iat) ||
        !Number.isInteger(payload.exp)
      ) {
        throw new UnauthorizedException('Invalid token payload');
      }

      request.user = {
        id: payload.sub,
        role: payload.role,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

}
