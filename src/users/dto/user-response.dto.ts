import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({ example: 'Mint' })
  name: string;

  @ApiProperty({ format: 'email', example: 'mint@example.com' })
  email: string;

  @ApiProperty({ enum: ['USER', 'ADMIN'], example: 'USER' })
  role: 'USER' | 'ADMIN';

  @ApiProperty({
    format: 'date-time',
    example: '2026-11-07T09:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-11-07T09:00:00.000Z',
  })
  updatedAt: string;
}

export class UserResponseEnvelopeDto {
  @ApiProperty({ type: UserResponseDto })
  data: UserResponseDto;

  @ApiProperty({
    description: 'Result message for registration or profile operations',
  })
  message: string;
}
