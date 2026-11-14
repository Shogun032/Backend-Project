import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('Hotel Booking OpenAPI contract', () => {
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
  it('documents Rooms request/response fields, optional PATCH fields and pagination', () => {
    const schemas = doc.components!.schemas!;
    for (const field of ['name', 'capacity', 'pricePerNight', 'images']) {
      expect(schemas.CreateRoomDto).toHaveProperty(`properties.${field}`);
      expect(schemas.RoomResponseDto).toHaveProperty(`properties.${field}`);
    }
    expect(schemas.UpdateRoomDto).not.toHaveProperty('required');
    expect(schemas.RoomListResponseDto).toHaveProperty('properties.meta');
    const search = doc.paths['/api/v1/rooms/search'].get!;
    expect(search.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'checkIn', required: true }),
        expect.objectContaining({ name: 'checkOut', required: true }),
        expect.objectContaining({ name: 'guests', required: true }),
        expect.objectContaining({ name: 'page', required: false }),
        expect.objectContaining({ name: 'limit', required: false }),
      ]),
    );
  });

  it('documents bearer security only for Admin Rooms operations', () => {
    for (const path of [
      '/api/v1/rooms',
      '/api/v1/rooms/search',
      '/api/v1/rooms/{roomId}',
    ]) {
      expect(doc.paths[path].get!.security ?? []).toHaveLength(0);
    }
    for (const operation of [
      doc.paths['/api/v1/rooms'].post!,
      doc.paths['/api/v1/rooms/{roomId}'].patch!,
      doc.paths['/api/v1/rooms/{roomId}'].delete!,
      doc.paths['/api/v1/admin/rooms'].get!,
      doc.paths['/api/v1/admin/rooms/{roomId}'].get!,
    ]) {
      expect(operation.security).toEqual([{ bearer: [] }]);
      for (const status of ['401', '403', '503']) {
        expect(operation.responses[status]).toHaveProperty(
          'content.application/json.schema.$ref',
        );
      }
    }
    expect(doc.paths['/api/v1/rooms'].post!.responses['201']).toHaveProperty(
      'headers.Location',
    );
    expect(
      doc.paths['/api/v1/rooms/{roomId}'].delete!.responses['204'],
    ).not.toHaveProperty('content');
    expect(doc.paths['/api/v1/rooms/{roomId}'].patch!.responses).toHaveProperty(
      '409',
    );
  });
  it('documents Booking schemas with calendar dates, string prices and status enums', () => {
    const schemas = doc.components!.schemas!;
    expect(schemas.CreateBookingDto).toHaveProperty('required', [
      'roomId',
      'checkIn',
      'checkOut',
      'guests',
    ]);
    expect(schemas.CreateBookingDto).not.toHaveProperty('properties.userId');
    expect(schemas.BookingResponseDto).toHaveProperty(
      'properties.checkIn.format',
      'date',
    );
    expect(schemas.BookingResponseDto).toHaveProperty(
      'properties.pricePerNight.type',
      'string',
    );
    expect(schemas.BookingResponseDto).toHaveProperty(
      'properties.status.enum',
      ['PENDING', 'APPROVED', 'CANCELLED', 'PAID'],
    );
    expect(schemas.BookingListResponseDto).toHaveProperty('properties.meta');
    expect(schemas.UpdateBookingStatusDto).toHaveProperty(
      'properties.status.enum',
      ['CANCELLED'],
    );
    expect(schemas.NotificationResponseDto).toHaveProperty('properties.userId');
    expect(schemas.NotificationResponseDto).not.toHaveProperty(
      'properties.isRead',
    );
  });

  it('documents bearer security, success and shared errors for all Booking and Notification routes', () => {
    const paths = [
      '/api/v1/bookings',
      '/api/v1/bookings/{bookingId}',
      '/api/v1/bookings/{bookingId}/status',
      '/api/v1/admin/bookings',
      '/api/v1/admin/bookings/{bookingId}',
      '/api/v1/admin/bookings/{bookingId}/status',
      '/api/v1/notifications',
    ];
    for (const path of paths) {
      const operations = [
        doc.paths[path].get,
        doc.paths[path].post,
        doc.paths[path].patch,
      ].filter((operation) => operation !== undefined);
      for (const operation of operations) {
        expect(operation.security).toEqual([{ bearer: [] }]);
        for (const status of ['400', '401', '503']) {
          expect(operation.responses[status]).toHaveProperty(
            'content.application/json.schema.$ref',
            '#/components/schemas/ApiErrorResponseDto',
          );
        }
        expect(operation.responses).toHaveProperty(
          operation === doc.paths['/api/v1/bookings'].post ? '201' : '200',
        );
        if (path.includes('/admin/'))
          expect(operation.responses).toHaveProperty('403');
      }
    }
    expect(doc.paths['/api/v1/bookings'].post!.responses['201']).toHaveProperty(
      'headers.Location',
    );
    expect(
      doc.paths['/api/v1/bookings/{bookingId}/status'].patch!.responses,
    ).toHaveProperty('409');
  });

  it('documents owner and Admin Booking filters with optional pagination', () => {
    expect(doc.paths['/api/v1/bookings'].get!.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'status', required: false }),
        expect.objectContaining({ name: 'page', required: false }),
        expect.objectContaining({ name: 'limit', required: false }),
      ]),
    );
    expect(doc.paths['/api/v1/admin/bookings'].get!.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'userId', required: false }),
        expect.objectContaining({ name: 'roomId', required: false }),
      ]),
    );
  });
  it.each([
    '/api/v1/rooms',
    '/api/v1/rooms/search',
    '/api/v1/admin/rooms',
    '/api/v1/bookings',
    '/api/v1/admin/bookings',
    '/api/v1/notifications',
  ])('documents integer pagination on %s', (path) => {
    const parameters = doc.paths[path].get!.parameters ?? [];
    for (const [name, defaultValue] of [
      ['page', 1],
      ['limit', 20],
    ] as const) {
      const matches = parameters.filter(
        (parameter) => 'name' in parameter && parameter.name === name,
      );
      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        name,
        in: 'query',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          default: defaultValue,
          ...(name === 'limit' ? { maximum: 100 } : {}),
        },
      });
    }
  });
  it('documents Retry-After for the shared 429 response', () => {
    for (const operation of [
      doc.paths['/api/v1/auth/login'].post!,
      doc.paths['/api/v1/bookings'].post!,
      doc.paths['/api/v1/rooms'].get!,
      doc.paths['/api/v1/notifications'].get!,
    ]) {
      expect(operation.responses['429']).toHaveProperty(
        'headers.Retry-After.schema.type',
        'integer',
      );
    }
  });
});
