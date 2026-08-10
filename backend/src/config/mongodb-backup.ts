import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export interface MongoBackupMetadata {
  version: 1;
  databaseName: string;
  createdAt: string;
  archiveFile: string;
  sha256: string;
  collectionCounts: Record<string, number>;
}

export function createMongoBackupFileName(
  databaseName: string,
  date = new Date(),
): string {
  const timestamp = date
    .toISOString()
    .replaceAll(':', '-')
    .replaceAll('.', '-');
  return `${databaseName}-${timestamp}.archive.gz`;
}

export async function calculateFileSha256(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

export function parseMongoBackupMetadata(value: unknown): MongoBackupMetadata {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('备份元数据必须是 JSON 对象');
  }

  const metadata = value as Partial<MongoBackupMetadata>;
  if (
    metadata.version !== 1 ||
    typeof metadata.databaseName !== 'string' ||
    typeof metadata.createdAt !== 'string' ||
    typeof metadata.archiveFile !== 'string' ||
    !/^[a-f0-9]{64}$/.test(metadata.sha256 ?? '') ||
    typeof metadata.collectionCounts !== 'object' ||
    metadata.collectionCounts === null ||
    Array.isArray(metadata.collectionCounts)
  ) {
    throw new Error('备份元数据字段不完整或格式错误');
  }

  for (const [collectionName, count] of Object.entries(
    metadata.collectionCounts,
  )) {
    if (!collectionName || !Number.isInteger(count) || count < 0) {
      throw new Error('备份元数据包含无效集合计数');
    }
  }

  return metadata as MongoBackupMetadata;
}
