import { Injectable } from '@nestjs/common';
import { User } from './types/user';
import { UsersRepository } from './users.repository';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ApiException } from '../common/exceptions/api.exception';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  create(user: User): Promise<User> {
    return this.usersRepository.create(user);
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    if (dto.name === undefined && dto.email === undefined) {
      throw new ApiException(
        400,
        'VALIDATION_ERROR',
        'At least one field is required',
      );
    }

    const user = await this.usersRepository.updateProfile(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
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
}
