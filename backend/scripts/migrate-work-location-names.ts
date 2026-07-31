import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import {
  Student,
  type StudentDocument,
} from '../src/modules/student/schemas/student.schema';
import {
  WorkLocationAssignment,
  type WorkLocationAssignmentDocument,
} from '../src/modules/work-location/schemas/work-location-assignment.schema';

const WORK_LOCATION_RENAMES = new Map<string, string>([
  ['上海研究院', '上海办公室 - 绿地汇'],
  ['上海办公室', '上海办公室 - 会德丰'],
  ['深圳办公室', '深圳办公室 - 1302'],
  ['深圳研究院', '深圳办公室 - 41层'],
]);

async function renameLocations<T extends { workLocation?: string }>(
  model: Model<T>,
): Promise<number> {
  let modifiedCount = 0;

  for (const [before, after] of WORK_LOCATION_RENAMES) {
    const result = await model
      .updateMany({ workLocation: before }, { $set: { workLocation: after } })
      .exec();
    modifiedCount += result.modifiedCount;
  }

  return modifiedCount;
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const studentModel = app.get<Model<StudentDocument>>(
      getModelToken(Student.name),
    );
    const assignmentModel = app.get<Model<WorkLocationAssignmentDocument>>(
      getModelToken(WorkLocationAssignment.name),
    );

    // 同步当前学生地点和地点时间线，避免定时任务把旧名称重新写回学生记录。
    const updatedStudents = await renameLocations(studentModel);
    const updatedAssignments = await renameLocations(assignmentModel);

    console.log(
      `地点名称迁移完成：更新 ${updatedStudents} 条学生记录、${updatedAssignments} 条地点安排记录。`,
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`地点名称迁移失败：${message}`);
  process.exitCode = 1;
});
