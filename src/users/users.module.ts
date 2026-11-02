import { Module } from '@nestjs/common';
import { TokenModule } from '../auth/token.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [TokenModule, PrismaModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
