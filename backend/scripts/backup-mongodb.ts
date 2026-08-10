import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { mongo } from 'mongoose';
import {
  calculateFileSha256,
  createMongoBackupFileName,
  type MongoBackupMetadata,
} from '../src/config/mongodb-backup';
import {
  assertProductionDatabaseName,
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

async function runMongodump(
  uri: string,
  databaseName: string,
  archive: string,
) {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn('mongodump', buildMongodumpArguments(uri, archive), {
      stdio: ['ignore', 'inherit', 'inherit'],
    });

    child.once('error', (error) =>
      reject(new Error(`无法启动 mongodump：${error.message}`)),
    );
    child.once('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`mongodump 执行失败，退出码 ${String(code)}`));
    });
  });
}

export function buildMongodumpArguments(
  uri: string,
  archive: string,
): string[] {
  // MongoDB Database Tools reliably parse connection strings and paths when
  // long options use the --option=value form.
  return [`--uri=${uri}`, `--archive=${archive}`, '--gzip'];
}

async function readCollectionCounts(
  uri: string,
  databaseName: string,
): Promise<Record<string, number>> {
  const client = new mongo.MongoClient(uri);
  await client.connect();

  try {
    const database = client.db(databaseName);
    const collections = await database
      .listCollections({}, { nameOnly: true })
      .toArray();
    const counts: Record<string, number> = {};

    for (const { name } of collections) {
      if (!name.startsWith('system.')) {
        counts[name] = await database.collection(name).countDocuments();
      }
    }

    return counts;
  } finally {
    await client.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error('环境变量 MONGODB_URI 不能为空');

  const databaseName = getMongoDatabaseName(uri);
  if (process.env.NODE_ENV === 'production') {
    assertProductionDatabaseName(databaseName);
  }

  const confirmedDatabase = readOption(args, '--confirm-database');
  if (confirmedDatabase !== databaseName) {
    throw new Error(
      `必须使用 --confirm-database ${databaseName} 明确确认备份目标`,
    );
  }

  const outputDirectory = resolve(
    process.cwd(),
    readOption(args, '--output-dir') ?? '../backups',
  );
  await mkdir(outputDirectory, { recursive: true });

  const archive = resolve(
    outputDirectory,
    createMongoBackupFileName(databaseName),
  );
  const collectionCounts = await readCollectionCounts(uri, databaseName);

  console.log(`开始备份 MongoDB 数据库：${databaseName}`);
  await runMongodump(uri, databaseName, archive);

  const metadata: MongoBackupMetadata = {
    version: 1,
    databaseName,
    createdAt: new Date().toISOString(),
    archiveFile: basename(archive),
    sha256: await calculateFileSha256(archive),
    collectionCounts,
  };
  const metadataPath = `${archive}.metadata.json`;
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, {
    mode: 0o600,
  });

  console.log('MongoDB 备份完成：');
  console.log(`  数据库：${databaseName}`);
  console.log(`  集合数：${Object.keys(collectionCounts).length}`);
  console.log(`  归档：${archive}`);
  console.log(`  校验信息：${metadataPath}`);
  console.log('请将归档和元数据一起保存到受控备份存储。');
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`MongoDB 备份失败：${message}`);
    process.exitCode = 1;
  });
}
