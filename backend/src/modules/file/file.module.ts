import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FILE_STORAGE } from './storage/file-storage.interface';
import { LocalFileStorageService } from './storage/local-file-storage.service';

@Module({
  imports: [ConfigModule],
  providers: [
    LocalFileStorageService,
    {
      // 业务代码注入 FILE_STORAGE，不直接依赖本地存储类。
      provide: FILE_STORAGE,
      useExisting: LocalFileStorageService,
    },
  ],
  exports: [FILE_STORAGE],
})
export class FileModule {}
