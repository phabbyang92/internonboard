import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import type { HealthService } from './health.service';

describe('HealthController', () => {
  it('sets HTTP 503 when a readiness dependency is down', async () => {
    const healthService = {
      getReadiness: jest.fn().mockResolvedValue({
        status: 'not_ready',
        service: 'intern-onboarding-api',
        timestamp: '2026-08-09T00:00:00.000Z',
        checks: {
          mongodb: { status: 'up' },
          fileStorage: { status: 'down', driver: 'owncloud' },
        },
      }),
    } as unknown as HealthService;
    const status = jest.fn();
    const response = { status } as unknown as Response;
    const controller = new HealthController(healthService);

    await controller.getReadiness(response);

    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});
