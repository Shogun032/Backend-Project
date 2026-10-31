import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { RequestWithId } from '../types/request-with-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(
    request: RequestWithId,
    response: Response,
    next: NextFunction,
  ) {
    const requestId = randomUUID();

    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);

    next();
  }
}
