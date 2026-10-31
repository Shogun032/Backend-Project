import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/exceptions/api.exception';

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { User } from '../users/types/user';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<Omit<User, 'passwordHash'>> {
    const existingUser = this.usersService.findByEmail(dto.email);

    if (existingUser) {
      throw new ApiException(
        409,
        'EMAIL_ALREADY_EXISTS',
        'Email already exists',
      );
    }

    const passwordHash = await argon2.hash(dto.password);

    if (this.usersService.findByEmail(dto.email)) {
      throw new ApiException(
        409,
        'EMAIL_ALREADY_EXISTS',
        'Email already exists',
      );
    }

    const now = new Date();

    const user = this.usersService.create({
      id: randomUUID(),
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: 'USER',
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async login(dto: LoginDto) {
    const user = this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new ApiException(
        401,
        'INVALID_CREDENTIALS',
        'Invalid email or password',
      );
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new ApiException(
        401,
        'INVALID_CREDENTIALS',
        'Invalid email or password',
      );
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
      jti: randomUUID(),
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: Number(
        this.configService.getOrThrow<string>('JWT_EXPIRES_IN'),
      ),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }
}
