import { HttpException } from '@nestjs/common';
import type { ErrorDetail } from '../types/api-error';

export class ApiException extends HttpException {
  constructor(
    status: number,
    code: string,
    message: string,
    details: ErrorDetail[] = [],
  ) {
    super({ code, message, details }, status);
  }
}
