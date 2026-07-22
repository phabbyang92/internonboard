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
import { WorkLocationAssignmentSource } from '../src/modules/work-location/work-location-assignment-source.enum';

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
    const students = await studentModel
      .find({
        isDeleted: false,
        ownerHrId: { $ne: null },
        workLocation: { $ne: null },
        onboardingStartAt: { $ne: null },
      })
      .select('_id ownerHrId workLocation onboardingStartAt')
      .exec();
    let createdCount = 0;

    for (const student of students) {
      const hasHistory = await assignmentModel.exists({
        studentId: student._id,
      });

      if (
        hasHistory ||
        !student.ownerHrId ||
        !student.workLocation ||
        !student.onboardingStartAt
      ) {
        continue;
      }

      await assignmentModel.create({
        studentId: student._id,
        workLocation: student.workLocation,
        effectiveFrom: student.onboardingStartAt,
        effectiveTo: null,
        changedByHrId: student.ownerHrId,
        source: WorkLocationAssignmentSource.Backfill,
      });
      createdCount += 1;
    }

    const cleanupResult = await studentModel
      .updateMany(
        { onlineOnboardingStartAt: { $exists: true } },
        { $unset: { onlineOnboardingStartAt: '' } },
      )
      .exec();

    console.log(
      `已为 ${createdCount} 名旧学生补充初始工作地点历史，并清理 ${cleanupResult.modifiedCount} 个旧线上开始日期字段。`,
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`工作地点历史回填失败：${message}`);
  process.exitCode = 1;
});
