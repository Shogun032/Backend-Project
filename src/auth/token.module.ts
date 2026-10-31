import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('JWT_SECRET');
        const expiresIn = Number(config.getOrThrow<string>('JWT_EXPIRES_IN'));

        if (!secret.trim() || secret === 'replace-with-your-own-local-secret') {
          throw new Error('Set JWT_SECRET to your own random secret');
        }

        if (!Number.isInteger(expiresIn) || expiresIn <= 0) {
          throw new Error('JWT_EXPIRES_IN must be a positive integer');
        }

        return {
          secret,
          signOptions: {
            algorithm: 'HS256',
            expiresIn,
          },
          verifyOptions: {
            algorithms: ['HS256'],
          },
        };
      },
    }),
  ],
  providers: [JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class TokenModule {}
