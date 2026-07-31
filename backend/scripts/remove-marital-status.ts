import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import {
  Student,
  type StudentDocument,
} from '../src/modules/student/schemas/student.schema';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const studentModel = app.get<Model<StudentDocument>>(
      getModelToken(Student.name),
    );

    // 使用原始 collection 清理已从 Mongoose Schema 删除的旧字段。
    const result = await studentModel.db.collection('students').updateMany(
      { 'basicInfo.maritalStatus': { $exists: true } },
      { $unset: { 'basicInfo.maritalStatus': '' } },
    );

    console.log(`婚姻状况字段清理完成：更新 ${result.modifiedCount} 条学生记录。`);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`婚姻状况字段清理失败：${message}`);
  process.exitCode = 1;
});
