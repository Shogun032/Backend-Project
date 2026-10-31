import { Injectable } from '@nestjs/common';
import { User } from  './types/user';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
  ) {}

  findByEmail(email: string): User | undefined {
    return this.usersRepository.findByEmail(email);
  }

  findById(id: string): User | undefined {
    return this.usersRepository.findById(id);
  }

  create(user: User): User {
    return this.usersRepository.create(user);
  }
}