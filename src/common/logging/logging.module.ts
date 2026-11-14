import { Module } from '@nestjs/common';
import { SecurityLoggerService } from './security-logger.service';

@Module({
  providers: [SecurityLoggerService],
  exports: [SecurityLoggerService],
})
export class LoggingModule {}
