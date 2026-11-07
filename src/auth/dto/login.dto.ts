import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  @ApiProperty({
    description: 'Email for Login to user account',
    example: 'mint@example.com',
    format: 'email',
    maxLength: 254,
  })
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @ApiProperty({
    description: 'Password length: 8–128 characters',
    example: 'TestPassword123!',
    format: 'password',
    minLength: 8,
    maxLength: 128,
    writeOnly: true,
  })
  password: string;
}
