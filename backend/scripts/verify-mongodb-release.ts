import { mongo } from 'mongoose';
import {
  assertProductionDatabaseName,
  getMongoDatabaseName,
} from '../src/config/release-readiness';

interface RequiredIndex {
  collection: string;
  name: string;
  unique?: boolean;
}

interface MongoIndexSummary {
  name: string;
  unique?: boolean;
}

function isMongoIndexSummary(value: unknown): value is MongoIndexSummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    (!('unique' in value) || typeof value.unique === 'boolean')
  );
}

const REQUIRED_INDEXES: RequiredIndex[] = [
  {
    collection: 'students',
    name: 'unique_student_name_email',
    unique: true,
  },
  {
    collection: 'attendance_records',
    name: 'unique_student_attendance_date',
    unique: true,
  },
  {
    collection: 'attendance_records',
    name: 'unique_check_in_device_attendance_date',
    unique: true,
  },
  {
    collection: 'attendance_calendar',
    name: 'unique_active_attendance_calendar_region_date',
    unique: true,
  },
  {
    collection: 'office_networks',
    name: 'unique_office_network_work_location',
    unique: true,
  },
];

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error('环境变量 MONGODB_URI 不能为空');

  const databaseName = getMongoDatabaseName(uri);
  if (process.env.NODE_ENV === 'production') {
    assertProductionDatabaseName(databaseName);
  }

  const client = new mongo.MongoClient(uri);
  await client.connect();

  try {
    const database = client.db(databaseName);
    await database.command({ ping: 1 });

    for (const required of REQUIRED_INDEXES) {
      const rawIndexes: unknown = await database
        .collection(required.collection)
        .listIndexes()
        .toArray();
      if (!Array.isArray(rawIndexes)) {
        throw new Error(`${required.collection} 索引列表格式错误`);
      }
      const indexes = rawIndexes.filter(isMongoIndexSummary);
      const actual = indexes.find((index) => index.name === required.name);

      if (!actual) {
        throw new Error(
          `${required.collection} 缺少必要索引 ${required.name}，请先启动新版本后端完成索引初始化`,
        );
      }
      if (required.unique && actual.unique !== true) {
        throw new Error(
          `${required.collection}.${required.name} 必须是唯一索引`,
        );
      }
    }

    console.log('MongoDB 正式库检查通过：');
    console.log(`  数据库：${databaseName}`);
    console.log(`  必要索引：${REQUIRED_INDEXES.length} 个`);
    console.log('  连接与读取权限：正常');
  } finally {
    await client.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`MongoDB 正式库检查失败：${message}`);
  process.exitCode = 1;
});
