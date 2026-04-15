import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const status = dbOk ? 'ok' : 'degraded';
    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      services: {
        database: dbOk ? 'ok' : 'unreachable',
      },
    };
  }
}
