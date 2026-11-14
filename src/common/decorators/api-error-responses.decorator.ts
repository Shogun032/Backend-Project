import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../dto/api-error-response.dto';
import type { ErrorDetail } from '../types/api-error';

interface ErrorDocumentation {
  status: number;
  code: string;
  message: string;
  details?: ErrorDetail[];
}

export function ApiErrorResponses(...errors: ErrorDocumentation[]) {
  const rateLimitError: ErrorDocumentation = {
    status: 429,
    code: 'RATE_LIMITED',
    message: 'ThrottlerException: Too Many Requests',
  };

  const documentedErrors = errors.some((error) => error.status === 429)
    ? errors
    : [...errors, rateLimitError];

  return applyDecorators(
    ApiExtraModels(ApiErrorResponseDto),
    ...documentedErrors.map(({ status, code, message, details = [] }) =>
      ApiResponse({
        status,
        description: message,
        headers: {
          ...(status === 429
            ? {
                'Retry-After': {
                  description: 'Seconds to wait before retrying this request',
                  schema: { type: 'integer' as const, minimum: 1 },
                },
              }
            : {}),
          'X-Request-Id': {
            description: 'Identifier for this request',
            schema: { type: 'string', format: 'uuid' },
          },
        },
        content: {
          'application/json': {
            schema: { $ref: getSchemaPath(ApiErrorResponseDto) },
            example: {
              error: { code, message, details },
              requestId: '550e8400-e29b-41d4-a716-446655440000',
            },
          },
        },
      }),
    ),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      type: ApiErrorResponseDto,
    }),
  );
}
