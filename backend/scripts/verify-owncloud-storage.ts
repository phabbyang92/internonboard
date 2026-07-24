import { ConfigService } from '@nestjs/config';
import { AttachmentType } from '../src/modules/student/enums/student.enums';
import { OwnCloudFileStorageService } from '../src/modules/file/storage/owncloud-file-storage.service';

async function readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks);
}

async function main(): Promise<void> {
  const service = new OwnCloudFileStorageService(new ConfigService());
  const expected = Buffer.from(
    `ownCloud storage verification ${new Date().toISOString()}`,
  );
  let storageKey: string | undefined;

  try {
    storageKey = await service.save({
      studentId: 'owncloud-verification',
      type: AttachmentType.Resume,
      originalName: 'verification.txt',
      buffer: expected,
    });

    const stream = await service.createReadStream(storageKey);
    const downloaded = await readStream(stream);

    if (!downloaded.equals(expected)) {
      throw new Error('上传和下载后的内容不一致');
    }

    console.log(`ownCloud 上传和下载验证成功：${storageKey}`);
  } finally {
    if (storageKey) {
      await service.delete(storageKey);
      console.log('远程验证文件已清理');
    }
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ownCloud 验证失败：${message}`);
  process.exitCode = 1;
});
