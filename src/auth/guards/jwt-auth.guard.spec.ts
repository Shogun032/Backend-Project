import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../redis/redis.service';
import { TokenModule } from '../token.module';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard token revocation', () => {
  let module: TestingModule;
  let guard: JwtAuthGuard;
  let jwt: JwtService;
  const isTokenRevoked = jest.fn<Promise<boolean>, [string]>();

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [TokenModule] })
      .overrideProvider(ConfigService)
      .useValue({
        getOrThrow: (key: string) =>
          ({
            JWT_SECRET: 'unit-test-secret-only',
            JWT_EXPIRES_IN: '900',
          })[key],
      })
      .overrideProvider(RedisService)
      .useValue({ isTokenRevoked })
      .compile();
    guard = module.get(JwtAuthGuard);
    jwt = module.get(JwtService);
  });

  beforeEach(() => {
    isTokenRevoked.mockReset().mockResolvedValue(false);
  });
  afterAll(async () => {
    await module?.close();
  });

  function context(token: string) {
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: `Bearer ${token}` },
    };
    const execution = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { request, execution };
  }

  async function validToken() {
    return jwt.signAsync({ sub: 'user-id', role: 'USER', jti: 'token-id' });
  }

  it('allows an active token and records user and token metadata', async () => {
    const { request, execution } = context(await validToken());
    await expect(guard.canActivate(execution)).resolves.toBe(true);
    expect(isTokenRevoked).toHaveBeenCalledWith('token-id');
    expect(request.user).toEqual({ id: 'user-id', role: 'USER' });
    expect(request.token?.jti).toBe('token-id');
    expect(typeof request.token?.exp).toBe('number');
  });

  it('rejects a revoked token with 401', async () => {
    isTokenRevoked.mockResolvedValue(true);
    await expect(
      guard.canActivate(context(await validToken()).execution),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('preserves 503 when the revocation service is unavailable', async () => {
    isTokenRevoked.mockRejectedValue(new ServiceUnavailableException());
    await expect(
      guard.canActivate(context(await validToken()).execution),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects invalid signatures without consulting Redis', async () => {
    await expect(
      guard.canActivate(context('invalid-token').execution),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(isTokenRevoked).not.toHaveBeenCalled();
  });
});
