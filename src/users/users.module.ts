import { Module } from '@nestjs/common';
import { TokenModule } from '../auth/token.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TokenModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}