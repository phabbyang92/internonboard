import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { mongo } from 'mongoose';
import {
  calculateFileSha256,
  parseMongoBackupMetadata,
} from '../src/config/mongodb-backup';
import {
  assertRestoreValidationDatabaseName,
  getMongoDatabaseName,
} from '../src/config/release-readiness';

function readOption(args: string[], option: string): string | undefined {
  const index = args.indexOf(option);
  if (index === -1) return undefined;

  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} 缺少参数值`);
  }
  return value;
}

async function runMongorestore(
  uri: string,
  archive: string,
  sourceDatabase: string,
  targetDatabase: string,
): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(
      'mongorestore',
      buildMongorestoreArguments(uri, archive, sourceDatabase, targetDatabase),
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );

    child.once('error', (error) =>
      reject(new Error(`无法启动 mongorestore：${error.message}`)),
    );
    child.once('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`mongorestore 执行失败，退出码 ${String(code)}`));
    });
  });
}

export function buildMongorestoreArguments(
  uri: string,
  archive: string,
  sourceDatabase: string,
  targetDatabase: string,
): string[] {
  const serverUri = new URL(uri);
  // A database path in --uri makes mongorestore add an implicit namespace
  // filter. Namespace remapping below is the single source of truth instead.
  serverUri.pathname = '/';

  return [
    `--uri=${serverUri.toString()}`,
    `--archive=${archive}`,
    '--gzip',
    '--drop',
    `--nsFrom=${sourceDatabase}.*`,
    `--nsTo=${targetDatabase}.*`,
  ];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const archiveOption = readOption(args, '--archive');
  if (!archiveOption) {
    throw new Error('必须使用 --archive 指定备份归档');
  }
  const archive = resolve(process.cwd(), archiveOption);

  const metadataPath = resolve(
    process.cwd(),
    readOption(args, '--metadata') ?? `${archive}.metadata.json`,
  );
  const metadata = parseMongoBackupMetadata(
    JSON.parse(await readFile(metadataPath, 'utf8')) as unknown,
  );

  if (metadata.archiveFile !== basename(archive)) {
    throw new Error('备份归档文件名与元数据不一致');
  }
  if ((await calculateFileSha256(archive)) !== metadata.sha256) {
    throw new Error('备份归档 SHA-256 与元数据不一致');
  }

  const targetUri = process.env.RESTORE_VALIDATION_MONGODB_URI?.trim();
  if (!targetUri) {
    throw new Error('环境变量 RESTORE_VALIDATION_MONGODB_URI 不能为空');
  }
  const targetDatabase = getMongoDatabaseName(targetUri);
  assertRestoreValidationDatabaseName(targetDatabase);

  if (readOption(args, '--confirm-target') !== targetDatabase) {
    throw new Error(
      `必须使用 --confirm-target ${targetDatabase} 明确确认恢复验证目标`,
    );
  }

  console.log(`开始将备份恢复到隔离验证库：${targetDatabase}`);
  await runMongorestore(
    targetUri,
    archive,
    metadata.databaseName,
    targetDatabase,
  );

  const client = new mongo.MongoClient(targetUri);
  await client.connect();

  try {
    const database = client.db(targetDatabase);
    for (const [collectionName, expectedCount] of Object.entries(
      metadata.collectionCounts,
    )) {
      const actualCount = await database
        .collection(collectionName)
        .countDocuments();
      if (actualCount !== expectedCount) {
        throw new Error(
          `${collectionName} 文档数不一致：预期 ${expectedCount}，实际 ${actualCount}`,
        );
      }
    }

    console.log('MongoDB 备份恢复验证通过：');
    console.log(`  来源数据库：${metadata.databaseName}`);
    console.log(`  验证数据库：${targetDatabase}`);
    console.log(
      `  已核对集合：${Object.keys(metadata.collectionCounts).length}`,
    );
  } finally {
    if (!args.includes('--keep-restored')) {
      await client.db(targetDatabase).dropDatabase();
      console.log('隔离恢复验证库已清理');
    }
    await client.close();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`MongoDB 备份恢复验证失败：${message}`);
    process.exitCode = 1;
  });
}
