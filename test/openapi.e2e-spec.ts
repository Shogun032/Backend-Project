import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('Users/Auth OpenAPI contract', () => {
  let app: INestApplication;
  let doc: OpenAPIObject;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(RedisService)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('documents login token fields and excludes passwordHash from public users', () => {
    const schemas = doc.components!.schemas!;
    expect(schemas.LoginDataDto).toHaveProperty('properties.accessToken');
    expect(schemas.LoginDataDto).toHaveProperty('properties.expiresIn');
    expect(schemas.LoginDataDto).toHaveProperty('properties.user');
    expect(schemas.UserResponseDto).not.toHaveProperty(
      'properties.passwordHash',
    );
    expect(schemas.UserResponseDto).not.toHaveProperty('properties.password');
    expect(doc.paths['/api/v1/auth/login'].post!.responses).toHaveProperty(
      '200',
    );
  });

  it('marks only protected routes as requiring bearer authentication', () => {
    expect(
      doc.paths['/api/v1/auth/register'].post!.security ?? [],
    ).toHaveLength(0);
    expect(doc.paths['/api/v1/auth/login'].post!.security ?? []).toHaveLength(
      0,
    );
    for (const operation of [
      doc.paths['/api/v1/auth/logout'].post!,
      doc.paths['/api/v1/users/me'].get!,
      doc.paths['/api/v1/users/me'].patch!,
    ]) {
      expect(operation.security).toEqual([{ bearer: [] }]);
    }
  });

  it('documents profile fields as optional and the logout response without a body', () => {
    expect(doc.components!.schemas!.UpdateProfileDto).not.toHaveProperty(
      'required',
    );
    expect(
      doc.paths['/api/v1/auth/logout'].post!.responses['204'],
    ).not.toHaveProperty('content');
    expect(
      doc.paths['/api/v1/auth/register'].post!.responses['201'],
    ).toHaveProperty('headers.Location');
  });

  it('documents shared error schemas and request IDs for actual error statuses', () => {
    const checks = [
      {
        operation: doc.paths['/api/v1/auth/register'].post!,
        statuses: ['400', '409'],
      },
      {
        operation: doc.paths['/api/v1/auth/login'].post!,
        statuses: ['400', '401'],
      },
      {
        operation: doc.paths['/api/v1/auth/logout'].post!,
        statuses: ['401', '503'],
      },
      {
        operation: doc.paths['/api/v1/users/me'].patch!,
        statuses: ['400', '401', '404', '409', '503'],
      },
    ];
    for (const { operation, statuses } of checks) {
      for (const status of statuses) {
        expect(operation.responses[status]).toHaveProperty(
          'content.application/json.schema.$ref',
          '#/components/schemas/ApiErrorResponseDto',
        );
        expect(operation.responses[status]).toHaveProperty(
          'headers.X-Request-Id',
        );
      }
    }
  });
});
