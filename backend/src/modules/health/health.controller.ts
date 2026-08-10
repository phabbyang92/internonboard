import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const result = await this.healthService.getReadiness();

    if (result.status !== 'ready') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }
}
