import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { configureHttp } from './http.config';

@Controller('ip-check')
class IpCheckController {
  @Get()
  read(@Req() req: Request) {
    return { ip: req.ip };
  }
}

describe('HTTP proxy configuration used by bootstrap', () => {
  let app: NestExpressApplication;
  afterEach(async () => {
    await app?.close();
  });

  async function start(trust: string) {
    const module = await Test.createTestingModule({
      controllers: [IpCheckController],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureHttp(app, new ConfigService({ TRUST_PROXY: trust }));
    await app.init();
  }

  it('ignores a forged X-Forwarded-For when proxy trust is disabled', async () => {
    await start('false');
    const response = await request(app.getHttpServer())
      .get('/api/v1/ip-check')
      .set('X-Forwarded-For', '203.0.113.10')
      .expect(200);
    expect((JSON.parse(response.text) as { ip: string }).ip).not.toBe(
      '203.0.113.10',
    );
  });

  it('ignores forwarded headers from a source outside the configured proxy addresses', async () => {
    await start('10.99.0.2');
    const response = await request(app.getHttpServer())
      .get('/api/v1/ip-check')
      .set('X-Forwarded-For', '203.0.113.10')
      .expect(200);
    expect((JSON.parse(response.text) as { ip: string }).ip).not.toBe(
      '203.0.113.10',
    );
  });

  it('uses the closest untrusted address rather than the attacker-controlled leftmost one', async () => {
    await start('loopback');
    const response = await request(app.getHttpServer())
      .get('/api/v1/ip-check')
      .set('X-Forwarded-For', '198.51.100.99, 203.0.113.10')
      .expect(200);
    expect((JSON.parse(response.text) as { ip: string }).ip).toBe(
      '203.0.113.10',
    );
  });
});
