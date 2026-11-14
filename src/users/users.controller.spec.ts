import { Logger } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';
import type { RequestWithId } from '../common/types/request-with-id';
import { SecurityLoggerService } from '../common/logging/security-logger.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

function createMocks() {
  const usersService = {
    updateProfile: jest.fn(),
  };

  const logSpy = jest
    .spyOn(Logger.prototype, 'log')
    .mockImplementation(() => undefined);

  const controller = new UsersController(
    usersService as unknown as UsersService,
    new SecurityLoggerService(),
  );

  return { controller, usersService, logSpy };
}

const request = {
  requestId: 'request-123',
  user: { id: 'user-456', role: 'USER' },
  headers: {
    authorization: 'Bearer private-token-for-test',
  },
} as AuthenticatedRequest & RequestWithId;

describe('Profile security logging', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs success without including profile data or the token', async () => {
    const { controller, usersService, logSpy } = createMocks();

    const profile = {
      id: 'user-456',
      name: 'Private Name',
      email: 'private@example.com',
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    usersService.updateProfile.mockResolvedValue(profile);

    await controller.updateMe(request, {
      name: profile.name,
      email: profile.email,
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'PROFILE_UPDATE_SUCCESS',
        requestId: 'request-123',
        userId: 'user-456',
      }),
    );
  });

  it('does not log success or expose the error when the update fails', async () => {
    const { controller, usersService, logSpy } = createMocks();
    const error = new Error('Internal database password=private-test-value');

    usersService.updateProfile.mockRejectedValue(error);

    await expect(
      controller.updateMe(request, { name: 'Changed' }),
    ).rejects.toBe(error);

    expect(logSpy).not.toHaveBeenCalled();
  });
});
