import { Logger } from '@nestjs/common';
import { SecurityLoggerService } from './security-logger.service';

describe('SecurityLoggerService', () => {
  let service: SecurityLoggerService;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    service = new SecurityLoggerService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('write only the event, request ID and user ID', () => {
    service.log('PROFILE_UPDATE_SUCCESS', 'request-123', 'user-456');

    expect(logSpy).toHaveBeenCalledTimes(1);

    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'PROFILE_UPDATE_SUCCESS',
        requestId: 'request-123',
        userId: 'user-456',
      }),
    );
  });

  it('omits user ID when the user is unknown', () => {
    service.log('AUTH_LOGIN_FAILURE', 'request-123');

    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'AUTH_LOGIN_FAILURE',
        requestId: 'request-123',
      }),
    );
  });
});
