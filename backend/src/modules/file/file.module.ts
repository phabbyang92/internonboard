import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  FILE_STORAGE,
  type FileStorage,
} from './storage/file-storage.interface';
import { LocalFileStorageService } from './storage/local-file-storage.service';
import { OwnCloudFileStorageService } from './storage/owncloud-file-storage.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: FILE_STORAGE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): FileStorage => {
        const driver = (
          configService.get<string>('FILE_STORAGE_DRIVER') ?? 'local'
        ).toLowerCase();

        if (driver === 'owncloud') {
          return new OwnCloudFileStorageService(configService);
        }

        if (driver === 'local') {
          return new LocalFileStorageService(configService);
        }

        throw new Error(
          `不支持的 FILE_STORAGE_DRIVER：${driver}，只能使用 local 或 owncloud`,
        );
      },
    },
  ],
  exports: [FILE_STORAGE],
})
export class FileModule {}
