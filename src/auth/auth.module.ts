import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenModule } from './token.module';
import { RedisModule } from '../redis/redis.module';
import { LoggingModule } from '../common/logging/logging.module';

@Module({
  imports: [UsersModule, TokenModule, ConfigModule, RedisModule, LoggingModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
