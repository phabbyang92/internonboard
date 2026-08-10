import type { ConfigService } from '@nestjs/config';
import type { Connection } from 'mongoose';
import type { FileStorage } from '../file/storage/file-storage.interface';
import { HealthService } from './health.service';

function createService() {
  const command = jest.fn().mockResolvedValue({ ok: 1 });
  const connection = { db: { command } } as unknown as Connection;
  const checkAvailability = jest.fn().mockResolvedValue(undefined);
  const fileStorage = {
    checkAvailability,
  } as unknown as FileStorage;
  const config = {
    get: jest.fn().mockReturnValue('owncloud'),
  } as unknown as ConfigService;

  return {
    command,
    fileStorage,
    checkAvailability,
    service: new HealthService(connection, fileStorage, config),
  };
}

describe('HealthService', () => {
  it('reports ready only when MongoDB and file storage are available', async () => {
    const { service, command, checkAvailability } = createService();

    await expect(service.getReadiness()).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        checks: {
          mongodb: { status: 'up' },
          fileStorage: { status: 'up', driver: 'owncloud' },
        },
      }),
    );
    expect(command).toHaveBeenCalledWith({ ping: 1 });
    expect(checkAvailability).toHaveBeenCalledTimes(1);
  });

  it('reports not ready without exposing dependency error messages', async () => {
    const { service, checkAvailability } = createService();
    checkAvailability.mockRejectedValueOnce(new Error('secret remote URL'));

    const result = await service.getReadiness();

    expect(result.status).toBe('not_ready');
    expect(result.checks.fileStorage).toEqual({
      status: 'down',
      driver: 'owncloud',
    });
    expect(JSON.stringify(result)).not.toContain('secret remote URL');
  });
});
