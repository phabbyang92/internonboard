import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import {
  AttendanceCalendar,
  type AttendanceCalendarDocument,
} from '../src/modules/attendance/schemas/attendance-calendar.schema';
import {
  HrUser,
  type HrUserDocument,
} from '../src/modules/auth/schemas/hr-user.schema';

const LEGACY_CALENDAR_INDEX = 'unique_active_attendance_calendar_date';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const hrUserModel = app.get<Model<HrUserDocument>>(
      getModelToken(HrUser.name),
    );
    const attendanceCalendarModel = app.get<Model<AttendanceCalendarDocument>>(
      getModelToken(AttendanceCalendar.name),
    );

    const hrResult = await hrUserModel
      .updateMany(
        { managedRegionCodes: { $exists: false } },
        { $set: { managedRegionCodes: [] } },
      )
      .exec();

    const legacyIndexExists = await attendanceCalendarModel.collection
      .indexExists(LEGACY_CALENDAR_INDEX)
      .catch(() => false);

    if (legacyIndexExists) {
      await attendanceCalendarModel.collection.dropIndex(
        LEGACY_CALENDAR_INDEX,
      );
    }

    // 确保地区版 Schema 中声明的新索引已经写入当前数据库。
    await attendanceCalendarModel.createIndexes();

    console.log('考勤地区数据迁移完成：');
    console.log(`  补充 HR 地区权限字段：${hrResult.modifiedCount}`);
    console.log(
      `  删除旧版单日期唯一索引：${legacyIndexExists ? '是' : '无需删除'}`,
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : '考勤地区数据迁移失败',
  );
  process.exitCode = 1;
});
