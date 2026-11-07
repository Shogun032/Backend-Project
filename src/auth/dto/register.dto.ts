import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @ApiProperty({
    description: 'Name of the User',
    example: 'Mint',
    minLength: 1,
    maxLength: 100,
  })
  name: string;

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
