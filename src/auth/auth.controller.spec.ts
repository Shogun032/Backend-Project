import {
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from './guards/jwt-auth.guard';
import type { RequestWithId } from '../common/types/request-with-id';
import { SecurityLoggerService } from '../common/logging/security-logger.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

function createMocks() {
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
  };

  const logSpy = jest
    .spyOn(Logger.prototype, 'log')
    .mockImplementation(() => undefined);

  const controller = new AuthController(
    authService as unknown as AuthService,
    new SecurityLoggerService(),
  );

  return { controller, authService, logSpy };
}

const request = {
  requestId: 'request-123',
} as RequestWithId;

const input = {
  email: 'private@example.com',
  password: 'PrivatePassword123!',
};

describe('Auth security logging', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs success without credentials or the issued token', async () => {
    const { controller, authService, logSpy } = createMocks();

    authService.login.mockResolvedValue({
      accessToken: 'private-token-for-test',
      user: { id: 'user-456', email: input.email },
    });

    await controller.login(input, request);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'AUTH_LOGIN_SUCCESS',
        requestId: 'request-123',
        userId: 'user-456',
      }),
    );
  });

  it('logs invalid credentials without recording the credentials', async () => {
    const { controller, authService, logSpy } = createMocks();
    const error = new UnauthorizedException('Invalid email or password');

    authService.login.mockRejectedValue(error);

    await expect(controller.login(input, request)).rejects.toBe(error);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'AUTH_LOGIN_FAILURE',
        requestId: 'request-123',
      }),
    );
  });

  it('rethrows internal errors without logging their contents', async () => {
    const { controller, authService, logSpy } = createMocks();
    const error = new Error('Database password=private-test-value');

    authService.login.mockRejectedValue(error);

    await expect(controller.login(input, request)).rejects.toBe(error);

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs registration success without the password or personal profile data', async () => {
    const { controller, authService, logSpy } = createMocks();
    const dto = { name: 'Private Name', ...input };
    const user = {
      id: 'user-456',
      name: dto.name,
      email: dto.email,
      role: 'USER' as const,
      createdAt: new Date('2026-11-14T00:00:00Z'),
      updatedAt: new Date('2026-11-14T00:00:00Z'),
    };
    const response = { setHeader: jest.fn() };
    authService.register.mockResolvedValue(user);

    const result = await controller.register(
      dto,
      request,
      response as unknown as Response,
    );

    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual({
      data: user,
      message: 'User registered successfully',
    });
    expect(response.setHeader).toHaveBeenCalledWith(
      'Location',
      '/api/v1/users/me',
    );
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'AUTH_REGISTER_SUCCESS',
        requestId: 'request-123',
        userId: 'user-456',
      }),
    );
  });

  it('does not log registration success or raw errors when registration fails', async () => {
    const { controller, authService, logSpy } = createMocks();
    const error = new Error(
      'Database password=private-registration-test-value',
    );
    const response = { setHeader: jest.fn() };
    authService.register.mockRejectedValue(error);

    await expect(
      controller.register(
        { name: 'Private Name', ...input },
        request,
        response as unknown as Response,
      ),
    ).rejects.toBe(error);

    expect(response.setHeader).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs logout success only after revocation completes, without the bearer token or jti', async () => {
    const { controller, authService, logSpy } = createMocks();
    const logoutRequest = {
      ...request,
      user: { id: 'user-456', role: 'USER' },
      token: { jti: 'private-jti-for-test', exp: 2_000_000_000 },
      headers: { authorization: 'Bearer private-logout-token-for-test' },
    } as AuthenticatedRequest & RequestWithId;
    let completeRevocation: () => void = () => undefined;
    const revocation = new Promise<void>((resolve) => {
      completeRevocation = resolve;
    });
    authService.logout.mockReturnValue(revocation);

    const result = controller.logout(logoutRequest);

    expect(authService.logout).toHaveBeenCalledWith(
      'private-jti-for-test',
      2_000_000_000,
    );
    expect(logSpy).not.toHaveBeenCalled();
    completeRevocation();
    await expect(result).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'AUTH_LOGOUT_SUCCESS',
        requestId: 'request-123',
        userId: 'user-456',
      }),
    );
  });

  it('does not log logout success when saving revocation fails', async () => {
    const { controller, authService, logSpy } = createMocks();
    const logoutRequest = {
      ...request,
      user: { id: 'user-456', role: 'USER' },
      token: { jti: 'private-jti-for-test', exp: 2_000_000_000 },
      headers: { authorization: 'Bearer private-logout-token-for-test' },
    } as AuthenticatedRequest & RequestWithId;
    const error = new ServiceUnavailableException('Redis unavailable');
    authService.logout.mockRejectedValue(error);

    await expect(controller.logout(logoutRequest)).rejects.toBe(error);

    expect(logSpy).not.toHaveBeenCalled();
  });
});
