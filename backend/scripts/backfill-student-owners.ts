import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import {
  HrUser,
  type HrUserDocument,
} from '../src/modules/auth/schemas/hr-user.schema';
import { OperationAction } from '../src/modules/operation-log/enums/operation-action.enum';
import {
  OperationLog,
  type OperationLogDocument,
} from '../src/modules/operation-log/schemas/operation-log.schema';
import {
  Student,
  type StudentDocument,
} from '../src/modules/student/schemas/student.schema';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const studentModel = app.get<Model<StudentDocument>>(
      getModelToken(Student.name),
    );
    const hrUserModel = app.get<Model<HrUserDocument>>(
      getModelToken(HrUser.name),
    );
    const operationLogModel = app.get<Model<OperationLogDocument>>(
      getModelToken(OperationLog.name),
    );
    const defaultOwnerEmail =
      process.env.DEFAULT_STUDENT_OWNER_EMAIL?.trim().toLowerCase();
    const defaultOwner = defaultOwnerEmail
      ? await hrUserModel.findOne({ email: defaultOwnerEmail }).exec()
      : null;

    if (defaultOwnerEmail && !defaultOwner) {
      throw new Error(`找不到默认 HR 账号：${defaultOwnerEmail}`);
    }

    const students = await studentModel
      .find({
        $or: [{ ownerHrId: { $exists: false } }, { ownerHrId: null }],
      })
      .select('_id')
      .exec();
    let updatedCount = 0;
    const unresolvedIds: string[] = [];

    for (const student of students) {
      const creationLog = await operationLogModel
        .findOne({
          studentId: student._id,
          action: OperationAction.StudentCreated,
        })
        .sort({ createdAt: 1 })
        .exec();
      const ownerHrId = creationLog?.operatorHrId ?? defaultOwner?._id;

      if (!ownerHrId) {
        unresolvedIds.push(student._id.toString());
        continue;
      }

      const ownerExists = await hrUserModel.exists({ _id: ownerHrId });

      if (!ownerExists) {
        if (!defaultOwner) {
          unresolvedIds.push(student._id.toString());
          continue;
        }
      }

      await studentModel
        .updateOne(
          {
            _id: student._id,
            $or: [{ ownerHrId: { $exists: false } }, { ownerHrId: null }],
          },
          { $set: { ownerHrId: ownerExists ? ownerHrId : defaultOwner!._id } },
        )
        .exec();
      updatedCount += 1;
    }

    console.log(`已回填 ${updatedCount} 条学生归属记录。`);

    if (unresolvedIds.length > 0) {
      throw new Error(
        `仍有 ${unresolvedIds.length} 条记录无法确定归属。请设置 DEFAULT_STUDENT_OWNER_EMAIL 后重试：${unresolvedIds.join(', ')}`,
      );
    }
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`学生归属回填失败：${message}`);
  process.exitCode = 1;
});
