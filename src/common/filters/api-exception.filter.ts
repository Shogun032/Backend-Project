import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ApiException } from '../exceptions/api.exception';
import type { ApiErrorResponse } from '../types/api-error';
import type { RequestWithId } from '../types/request-with-id';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    const codes: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'RESOURCE_NOT_FOUND',
      409: 'CONFLICT',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };

    let message = 'Internal server error';
    let code = codes[status] ?? 'HTTP_ERROR';
    let details: ApiErrorResponse['error']['details'] = [];

    if (status < 500 && exception instanceof ApiException) {
      const body = exception.getResponse() as ApiErrorResponse['error'];
      code = body.code;
      message = body.message;
      details = body.details;
    } else if (status === 400) {
      message = 'Invalid request data';
    } else if (status < 500 && exception instanceof HttpException) {
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else {
        const errorBody = body as { message?: string | string[] };

        message = Array.isArray(errorBody.message)
          ? 'Invalid request data'
          : (errorBody.message ?? exception.message);
      }
    } else if (status === 503) {
      message = 'Service unavailable';
    }

    const requestId = request.requestId ?? randomUUID();
    response.setHeader('X-Request-Id', requestId);

    const body: ApiErrorResponse = {
      error: {
        code,
        message,
        details,
      },
      requestId,
    };

    response.status(status).json(body);
  }
}
