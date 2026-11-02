import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(user: {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: 'USER' | 'ADMIN';
    createdAt: Date;
    updatedAt: Date;
  }) {
    return this.prisma.user.create({
      data: user,
    });
  }
}