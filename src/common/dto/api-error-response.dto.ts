import { ApiProperty } from '@nestjs/swagger';

export class ErrorDetailDto {
  @ApiProperty({ example: 'email' })
  field: string;

  @ApiProperty({ example: 'email must be an email' })
  message: string;
}

export class ApiErrorDto {
  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code: string;

  @ApiProperty({ example: 'Invalid request data' })
  message: string;

  @ApiProperty({
    type: [ErrorDetailDto],
    description: 'Always an array; empty if there are no field details',
  })
  details: ErrorDetailDto[];
}

export class ApiErrorResponseDto {
  @ApiProperty({ type: ApiErrorDto })
  error: ApiErrorDto;

  @ApiProperty({
    format: 'uuid',
    description: 'Matches the X-Request-Id response header',
  })
  requestId: string;
}
