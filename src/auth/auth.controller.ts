import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedRequest } from './guards/jwt-auth.guard';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserResponseEnvelopeDto } from '../users/dto/user-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a USER account' })
  @ApiErrorResponses(
    {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: [{ field: 'email', message: 'email must be an email' }],
    },
    {
      status: 409,
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'Email already exists',
    },
  )
  @ApiCreatedResponse({
    description: 'สมัครสมาชิกสำเร็จ',
    type: UserResponseEnvelopeDto,
    headers: {
      Location: {
        description: 'เส้นทางดูบัญชีหลังเข้าสู่ระบบ',
        schema: { type: 'string', example: '/api/v1/users/me' },
      },
    },
  })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.authService.register(dto);

    response.setHeader('Location', '/api/v1/users/me');

    return {
      data: user,
      message: 'User registered successfully',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and issue an access token' })
  @ApiOkResponse({ description: 'Login successful', type: LoginResponseDto })
  @ApiErrorResponses(
    { status: 400, code: 'VALIDATION_ERROR', message: 'Invalid request data' },
    {
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    },
  )
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);

    return {
      data: result,
      message: 'Login successful',
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke the current access token',
    description:
      'Other sessions remain active. The current token must be valid and not already revoked.',
  })
  @ApiErrorResponses(
    {
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid, expired or revoked token',
    },
    {
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Authentication service unavailable',
    },
  )
  @ApiNoContentResponse({
    description: 'ออกจากระบบสำเร็จ ไม่มี response body',
  })
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.authService.logout(request.token.jti, request.token.exp);
  }
}
