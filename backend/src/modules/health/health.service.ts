import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../file/storage/file-storage.interface';

type DependencyStatus = 'up' | 'down';

interface DependencyCheck {
  status: DependencyStatus;
}

export interface ReadinessResult {
  status: 'ready' | 'not_ready';
  service: string;
  timestamp: string;
  checks: {
    mongodb: DependencyCheck;
    fileStorage: DependencyCheck & { driver: string };
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(FILE_STORAGE) private readonly fileStorage: FileStorage,
    private readonly config: ConfigService,
  ) {}

  getLiveness() {
    return {
      status: 'ok' as const,
      service: 'intern-onboarding-api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async getReadiness(): Promise<ReadinessResult> {
    const [mongodb, fileStorage] = await Promise.all([
      this.checkMongoDb(),
      this.checkFileStorage(),
    ]);
    const ready = mongodb.status === 'up' && fileStorage.status === 'up';

    return {
      status: ready ? 'ready' : 'not_ready',
      service: 'intern-onboarding-api',
      timestamp: new Date().toISOString(),
      checks: { mongodb, fileStorage },
    };
  }

  private async checkMongoDb(): Promise<DependencyCheck> {
    try {
      if (!this.connection.db) {
        throw new Error('MongoDB connection is not initialized');
      }

      await this.connection.db.command({ ping: 1 });
      return { status: 'up' };
    } catch {
      this.logger.warn('event=health_dependency_down dependency=mongodb');
      return { status: 'down' };
    }
  }

  private async checkFileStorage(): Promise<
    DependencyCheck & { driver: string }
  > {
    const driver = this.config.get<string>('FILE_STORAGE_DRIVER') ?? 'local';

    try {
      await this.fileStorage.checkAvailability();
      return { status: 'up', driver };
    } catch {
      this.logger.warn(
        `event=health_dependency_down dependency=file_storage driver=${driver}`,
      );
      return { status: 'down', driver };
    }
  }
}
