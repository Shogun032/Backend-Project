import {
  Controller,
  Get,
  NotFoundException,
  Req,
  UseGuards,
  Body,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserResponseEnvelopeDto } from './dto/user-response.dto';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import { SecurityLoggerService } from '../common/logging/security-logger.service';
import type { RequestWithId } from '../common/types/request-with-id';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly securityLogger: SecurityLoggerService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get your own profile' })
  @ApiErrorResponses(
    {
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid, expired or revoked token',
    },
    { status: 404, code: 'RESOURCE_NOT_FOUND', message: 'User not found' },
    {
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Authentication service unavailable',
    },
  )
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description: 'ข้อมูลบัญชีของผู้ใช้ที่เข้าสู่ระบบ',
    type: UserResponseEnvelopeDto,
  })
  async getMe(@Req() request: AuthenticatedRequest) {
    const user = await this.usersService.findById(request.user.id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      message: 'User retrieved',
    };
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update your own name or email',
    description:
      'Provide at least one field. Empty bodies, null values, role and password changes are rejected.',
  })
  @ApiErrorResponses(
    {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: [
        {
          field: 'name',
          message: 'name must be longer than or equal to 1 characters',
        },
      ],
    },
    {
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid, expired or revoked token',
    },
    { status: 404, code: 'RESOURCE_NOT_FOUND', message: 'User not found' },
    {
      status: 409,
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'Email already exists',
    },
    {
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Authentication service unavailable',
    },
  )
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description: 'แก้ไขโปรไฟล์สำเร็จ',
    type: UserResponseEnvelopeDto,
  })
  async updateMe(
    @Req() request: AuthenticatedRequest & RequestWithId,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.usersService.updateProfile(request.user.id, dto);

    this.securityLogger.log(
      'PROFILE_UPDATE_SUCCESS',
      request.requestId,
      user.id,
    );

    return {
      data: user,
      message: 'Profile updated',
    };
  }
}
