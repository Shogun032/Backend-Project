import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from '../common/exceptions/api.exception';
import { User } from './types/user';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(user: User): Promise<User> {
    try {
      return await this.prisma.user.create({ data: user });
    } catch (error) {
      // The database constraint also protects simultaneous registrations.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String(error.meta?.target).includes('email')
      ) {
        throw new ApiException(
          409,
          'EMAIL_ALREADY_EXISTS',
          'Email already exists',
        );
      }
      throw error;
    }
  }
}
