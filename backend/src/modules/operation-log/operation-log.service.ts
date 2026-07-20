import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Types } from 'mongoose';
import type { Model, QueryFilter } from 'mongoose';
import { OperationAction } from './enums/operation-action.enum';
import {
  OperationLog,
  type OperationLogDocument,
} from './schemas/operation-log.schema';

interface RecordOperationInput {
  operatorHrId: string;
  studentId: string;
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
    const operationLog = await this.operationLogModel.create({
      operatorHrId: new Types.ObjectId(input.operatorHrId),
      studentId: new Types.ObjectId(input.studentId),
      action: input.action,
      changes: input.changes ?? null,
    });

    return {
      id: operationLog._id.toString(),
      operatorHrId: operationLog.operatorHrId.toString(),
      studentId: operationLog.studentId.toString(),
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
        studentId: log.studentId.toString(),
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
