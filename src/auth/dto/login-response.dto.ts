import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class LoginDataDto {
  @ApiProperty({
    description: 'JWT access token; send it in the Authorization header',
    example: 'JWT_ACCESS_TOKEN',
  })
  accessToken: string;

  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({
    description: 'Token lifetime in seconds',
    example: 900,
    minimum: 1,
  })
  expiresIn: number;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class LoginResponseDto {
  @ApiProperty({ type: LoginDataDto })
  data: LoginDataDto;

  @ApiProperty({ example: 'Login successful' })
  message: string;
}
