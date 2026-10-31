import { ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { ApiException } from '../exceptions/api.exception';
import type { ErrorDetail } from '../types/api-error';

function collectDetails(errors: ValidationError[], parent = ''): ErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    return [
      ...Object.values(error.constraints ?? {}).map((message) => ({
        field,
        message,
      })),
      ...collectDetails(error.children ?? [], field),
    ];
  });
}

export function createApiValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors) =>
      new ApiException(
        400,
        'VALIDATION_ERROR',
        'Invalid request data',
        collectDetails(errors),
      ),
  });
}
