import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Types } from 'mongoose';
import type { Model } from 'mongoose';
import {
  WorkLocationAssignment,
  type WorkLocationAssignmentDocument,
} from './schemas/work-location-assignment.schema';
import { WorkLocationAssignmentSource } from './work-location-assignment-source.enum';

interface RecordWorkLocationInput {
  studentId: string;
  workLocation: string;
  onboardingStartAt: Date | null;
  changedByHrId: string;
  source: WorkLocationAssignmentSource;
}

@Injectable()
export class WorkLocationHistoryService {
  constructor(
    @InjectModel(WorkLocationAssignment.name)
    private readonly assignmentModel: Model<WorkLocationAssignmentDocument>,
  ) {}

  async recordAssignment(input: RecordWorkLocationInput) {
    this.validateObjectIds(input.studentId, input.changedByHrId);

    const now = new Date();
    const originalEffectiveFrom = input.onboardingStartAt ?? now;

    const current = await this.assignmentModel
      .findOne({
        studentId: new Types.ObjectId(input.studentId),
        effectiveTo: null,
      })
      .sort({ effectiveFrom: -1 })
      .exec();

    // 尚未生效的安排发生变化时，直接修正计划，不制造零时长记录。
    if (current && current.effectiveFrom > now) {
      current.workLocation = input.workLocation;
      current.effectiveFrom =
        originalEffectiveFrom > now ? originalEffectiveFrom : now;
      current.changedByHrId = new Types.ObjectId(input.changedByHrId);
      current.source = input.source;
      await current.save();

      return this.toResponse(current);
    }

    // 地点没有变化时，不重复创建相同的历史记录。
    if (current?.workLocation === input.workLocation) {
      return this.toResponse(current);
    }

    if (current) {
      current.effectiveTo = now;
      await current.save();
    }

    const assignment = await this.assignmentModel.create({
      studentId: new Types.ObjectId(input.studentId),
      workLocation: input.workLocation,

      // 第一条记录可从原入职日期开始；已有记录后的地点变更从现在生效。
      effectiveFrom: current ? now : originalEffectiveFrom,
      effectiveTo: null,
      changedByHrId: new Types.ObjectId(input.changedByHrId),
      source: input.source,
    });

    return this.toResponse(assignment);
  }

  async findByStudentId(studentId: string) {
    if (!isValidObjectId(studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    const assignments = await this.assignmentModel
      .find({ studentId: new Types.ObjectId(studentId) })
      .sort({ effectiveFrom: -1 })
      .exec();

    return assignments.map((assignment) => this.toResponse(assignment));
  }

  async closeCurrentAssignment(studentId: string, closedAt = new Date()) {
    if (!isValidObjectId(studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    const assignment = await this.assignmentModel
      .findOne({
        studentId: new Types.ObjectId(studentId),
        effectiveTo: null,
      })
      .sort({ effectiveFrom: -1 })
      .exec();

    if (!assignment) {
      return null;
    }

    // 尚未生效的计划被取消时，用开始时间关闭，避免结束早于开始。
    assignment.effectiveTo =
      closedAt < assignment.effectiveFrom ? assignment.effectiveFrom : closedAt;
    await assignment.save();

    return this.toResponse(assignment);
  }

  private validateObjectIds(studentId: string, hrUserId: string): void {
    if (!isValidObjectId(studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    if (!isValidObjectId(hrUserId)) {
      throw new BadRequestException('HR ID 格式错误');
    }
  }

  private toResponse(assignment: WorkLocationAssignmentDocument) {
    return {
      id: assignment._id.toString(),
      studentId: assignment.studentId.toString(),
      workLocation: assignment.workLocation,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo,
      changedByHrId: assignment.changedByHrId.toString(),
      source: assignment.source,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }
}
