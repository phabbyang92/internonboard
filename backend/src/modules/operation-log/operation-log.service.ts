import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Types } from 'mongoose';
import type { Model, QueryFilter } from 'mongoose';
import { OperationAction } from './enums/operation-action.enum';
import { OperationTargetType } from './enums/operation-target-type.enum';
import {
  OperationLog,
  type OperationLogDocument,
} from './schemas/operation-log.schema';

interface RecordOperationInput {
  operatorHrId: string;
  studentId?: string;
  targetType?: OperationTargetType;
  targetId?: string;
  action: OperationAction;
  changes?: Record<string, unknown>;
}

interface ListOperationLogsQuery {
  page?: number;
  limit?: number;
  action?: OperationAction;
}

@Injectable()
export class OperationLogService {
  constructor(
    @InjectModel(OperationLog.name)
    private readonly operationLogModel: Model<OperationLogDocument>,
  ) {}

  async record(input: RecordOperationInput) {
    const targetType = input.targetType ?? OperationTargetType.Student;
    const targetId = input.targetId ?? input.studentId;

    if (!isValidObjectId(input.operatorHrId)) {
      throw new BadRequestException('操作人 HR ID 格式错误');
    }

    if (!targetId || !isValidObjectId(targetId)) {
      throw new BadRequestException('操作日志目标 ID 格式错误');
    }

    if (input.studentId && !isValidObjectId(input.studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    const operationLog = await this.operationLogModel.create({
      operatorHrId: new Types.ObjectId(input.operatorHrId),
      studentId: input.studentId ? new Types.ObjectId(input.studentId) : null,
      targetType,
      targetId: new Types.ObjectId(targetId),
      action: input.action,
      changes: input.changes ?? null,
    });

    return {
      id: operationLog._id.toString(),
      operatorHrId: operationLog.operatorHrId.toString(),
      studentId: operationLog.studentId?.toString() ?? null,
      targetType: operationLog.targetType ?? targetType,
      targetId: operationLog.targetId?.toString() ?? targetId,
      action: operationLog.action,
      changes: operationLog.changes,
      createdAt: operationLog.createdAt,
    };
  }

  async findByStudentId(studentId: string, query: ListOperationLogsQuery) {
    if (!isValidObjectId(studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: QueryFilter<OperationLogDocument> = {
      studentId: new Types.ObjectId(studentId),
    };

    if (query.action) {
      filter.action = query.action;
    }

    const [logs, total] = await Promise.all([
      this.operationLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.operationLogModel.countDocuments(filter).exec(),
    ]);

    return {
      items: logs.map((log) => ({
        id: log._id.toString(),
        operatorHrId: log.operatorHrId.toString(),
        studentId: log.studentId?.toString() ?? null,
        // 旧日志没有 target 字段时，仍按学生日志返回，避免历史数据读取失败。
        targetType: log.targetType ?? OperationTargetType.Student,
        targetId: log.targetId?.toString() ?? log.studentId?.toString() ?? null,
        action: log.action,
        changes: log.changes,
        createdAt: log.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
