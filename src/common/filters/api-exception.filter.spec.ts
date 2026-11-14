import {
  ArgumentsHost,
  ForbiddenException,
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { SecurityLoggerService } from '../logging/security-logger.service';
import type { ApiErrorResponse } from '../types/api-error';
import { ApiExceptionFilter } from './api-exception.filter';

function createContext(requestId: string | null = 'request-123') {
  const logSpy = jest
    .spyOn(Logger.prototype, 'log')
    .mockImplementation(() => undefined);
  const warnSpy = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
  const errorSpy = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
  const request = {
    requestId: requestId ?? undefined,
    headers: { authorization: 'Bearer private-test-token' },
    body: { password: 'PrivateTestPassword123!' },
    query: { token: 'private-query-token' },
    originalUrl: '/api/v1/bookings?token=private-query-token',
  };
  const response = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn((body: ApiErrorResponse) => body),
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  const filter = new ApiExceptionFilter(new SecurityLoggerService());
  return { filter, host, response, logSpy, warnSpy, errorSpy };
}

describe('HTTP error logging with the real SecurityLoggerService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    {
      exception: new ForbiddenException('Insufficient permissions'),
      status: 403,
      code: 'FORBIDDEN',
    },
    { exception: new ThrottlerException(), status: 429, code: 'RATE_LIMITED' },
  ])(
    'logs $status at WARN without request credentials or query strings',
    ({ exception, status, code }) => {
      const { filter, host, response, logSpy, warnSpy, errorSpy } =
        createContext();

      filter.catch(exception, host);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'HTTP_REQUEST_REJECTED',
          requestId: 'request-123',
          status,
        }),
      );
      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.setHeader).toHaveBeenCalledWith(
        'X-Request-Id',
        'request-123',
      );
      expect(response.json.mock.calls[0][0]).toMatchObject({
        error: { code },
        requestId: 'request-123',
      });
    },
  );

  it.each([
    {
      exception: new Error('SQL password=private-database-password'),
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
    {
      exception: new ServiceUnavailableException(
        'redis://private-password@host',
      ),
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service unavailable',
    },
  ])(
    'logs $status at ERROR and hides the original error from logs and the response',
    ({ exception, status, code, message }) => {
      const { filter, host, response, logSpy, warnSpy, errorSpy } =
        createContext();

      filter.catch(exception, host);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'HTTP_SERVER_ERROR',
          requestId: 'request-123',
          status,
        }),
      );
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.json).toHaveBeenCalledWith({
        error: { code, message, details: [] },
        requestId: 'request-123',
      });
    },
  );

  it.each([400, 401, 404, 409])(
    'does not add an HTTP security log for %s',
    (status) => {
      const { filter, host, response, logSpy, warnSpy, errorSpy } =
        createContext();

      filter.catch(new HttpException('Request failed', status), host);

      expect(response.status).toHaveBeenCalledWith(status);
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    },
  );

  it('uses the same generated request ID in the log, response header and body', () => {
    const { filter, host, response, errorSpy } = createContext(null);

    filter.catch(new Error('Private internal error'), host);

    const body = response.json.mock.calls[0][0];
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      body.requestId,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'HTTP_SERVER_ERROR',
        requestId: body.requestId,
        status: 500,
      }),
    );
  });
});
