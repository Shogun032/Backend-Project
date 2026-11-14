import { Injectable, Logger } from '@nestjs/common';

type AuthSecurityEvent =
  | 'AUTH_REGISTER_SUCCESS'
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_LOGOUT_SUCCESS'
  | 'PROFILE_UPDATE_SUCCESS';

type HttpSecurityEvent = 'HTTP_SERVER_ERROR' | 'HTTP_REQUEST_REJECTED';

@Injectable()
export class SecurityLoggerService {
  private readonly logger = new Logger(SecurityLoggerService.name);

  log(event: AuthSecurityEvent, requestId: string, userId?: string): void {
    this.logger.log(
      JSON.stringify({
        event,
        requestId,
        userId,
      }),
    );
  }

  logHttpError(status: number, requestId: string): void {
    if (status !== 403 && status !== 429 && status < 500) {
      return;
    }

    const isServerError = status >= 500;
    const event: HttpSecurityEvent = isServerError
      ? 'HTTP_SERVER_ERROR'
      : 'HTTP_REQUEST_REJECTED';

    const entry = JSON.stringify({
      event,
      requestId,
      status,
    });

    if (isServerError) {
      this.logger.error(entry);
    } else {
      this.logger.warn(entry);
    }
  }
}
