import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Types } from 'mongoose';
import type { Model } from 'mongoose';
import {
  Student,
  type StudentDocument,
} from '../student/schemas/student.schema';
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

interface ChangeWorkLocationInput {
  studentId: string;
  workLocation: string;
  effectiveFrom: Date;
  changedByHrId: string;
}

interface UpdateWorkLocationAssignmentInput extends ChangeWorkLocationInput {
  assignmentId: string;
}

interface RemoveWorkLocationAssignmentInput {
  studentId: string;
  assignmentId: string;
}

@Injectable()
export class WorkLocationHistoryService {
  constructor(
    @InjectModel(WorkLocationAssignment.name)
    private readonly assignmentModel: Model<WorkLocationAssignmentDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
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

  async changeLocation(input: ChangeWorkLocationInput) {
    this.validateObjectIds(input.studentId, input.changedByHrId);

    const assignments = await this.assignmentModel
      .find({ studentId: new Types.ObjectId(input.studentId) })
      .sort({ effectiveFrom: 1 })
      .exec();

    if (assignments.length === 0) {
      throw new BadRequestException('请先为学生设置初始工作地点');
    }

    const sameStart = assignments.find(
      (assignment) =>
        assignment.effectiveFrom.getTime() === input.effectiveFrom.getTime(),
    );

    // 同一天已有一段记录时，直接修正地点，避免生成重叠记录。
    if (sameStart) {
      if (sameStart.workLocation === input.workLocation) {
        throw new BadRequestException('该日期的工作地点没有变化');
      }

      sameStart.workLocation = input.workLocation;
      sameStart.changedByHrId = new Types.ObjectId(input.changedByHrId);
      sameStart.source = WorkLocationAssignmentSource.Change;
      await sameStart.save();

      return this.toResponse(sameStart);
    }

    const containing = assignments.find(
      (assignment) =>
        assignment.effectiveFrom < input.effectiveFrom &&
        (assignment.effectiveTo === null ||
          input.effectiveFrom < assignment.effectiveTo),
    );

    if (containing?.workLocation === input.workLocation) {
      throw new BadRequestException('该日期的工作地点没有变化');
    }

    const nextAssignment = assignments.find(
      (assignment) => assignment.effectiveFrom > input.effectiveFrom,
    );
    const originalEffectiveTo = containing?.effectiveTo ?? null;

    if (containing) {
      // 在已有时间段中间插入地点时，把原时间段截断到新日期。
      containing.effectiveTo = input.effectiveFrom;
      await containing.save();
    }

    try {
      const assignment = await this.assignmentModel.create({
        studentId: new Types.ObjectId(input.studentId),
        workLocation: input.workLocation,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: containing
          ? originalEffectiveTo
          : (nextAssignment?.effectiveFrom ?? null),
        changedByHrId: new Types.ObjectId(input.changedByHrId),
        source: WorkLocationAssignmentSource.Change,
      });

      return this.toResponse(assignment);
    } catch (error: unknown) {
      // 当前项目未要求 MongoDB replica set，创建失败时恢复被截断的时间段。
      if (containing) {
        containing.effectiveTo = originalEffectiveTo;
        await containing.save();
      }
      throw error;
    }
  }

  async updateAssignment(input: UpdateWorkLocationAssignmentInput) {
    this.validateObjectIds(input.studentId, input.changedByHrId);
    this.validateAssignmentId(input.assignmentId);

    const assignments = await this.findStudentAssignments(input.studentId);
    const assignmentIndex = assignments.findIndex(
      (assignment) => assignment._id.toString() === input.assignmentId,
    );

    if (assignmentIndex === -1) {
      throw new NotFoundException('工作地点记录不存在');
    }

    // 第一段是学生的原始入职安排，不允许在地点历史中被改写。
    if (assignmentIndex === 0) {
      throw new BadRequestException('第一段工作地点记录不能修改');
    }

    const assignment = assignments[assignmentIndex];
    const previousAssignment = assignments[assignmentIndex - 1];
    const nextAssignment = assignments[assignmentIndex + 1];

    if (input.effectiveFrom <= previousAssignment.effectiveFrom) {
      throw new BadRequestException('本段开始日期必须晚于上一段实习开始日期');
    }

    if (nextAssignment && input.effectiveFrom >= nextAssignment.effectiveFrom) {
      throw new BadRequestException('本段开始日期必须早于下一段实习开始日期');
    }

    if (
      previousAssignment.workLocation === input.workLocation ||
      nextAssignment?.workLocation === input.workLocation
    ) {
      throw new BadRequestException('相邻时间段不能设置为相同工作地点');
    }

    if (
      assignment.workLocation === input.workLocation &&
      assignment.effectiveFrom.getTime() === input.effectiveFrom.getTime()
    ) {
      throw new BadRequestException('工作地点和开始日期均未发生变化');
    }

    const before = this.toResponse(assignment);
    assignment.workLocation = input.workLocation;
    assignment.effectiveFrom = input.effectiveFrom;
    assignment.changedByHrId = new Types.ObjectId(input.changedByHrId);
    assignment.source = WorkLocationAssignmentSource.Change;

    // 先保存被修改的记录，再根据相邻开始日期统一重算所有结束日期。
    await assignment.save();
    await this.rebuildTimeline(assignments);

    return {
      before,
      assignment: this.toResponse(assignment),
    };
  }

  async removeAssignment(input: RemoveWorkLocationAssignmentInput) {
    if (!isValidObjectId(input.studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }
    this.validateAssignmentId(input.assignmentId);

    const assignments = await this.findStudentAssignments(input.studentId);
    const assignmentIndex = assignments.findIndex(
      (assignment) => assignment._id.toString() === input.assignmentId,
    );

    if (assignmentIndex === -1) {
      throw new NotFoundException('工作地点记录不存在');
    }

    if (assignmentIndex === 0) {
      throw new BadRequestException('第一段工作地点记录不能撤销');
    }

    const assignment = assignments[assignmentIndex];
    const removed = this.toResponse(assignment);
    await assignment.deleteOne();

    const remainingAssignments = assignments.filter(
      (_, index) => index !== assignmentIndex,
    );
    const previousAssignment = remainingAssignments[assignmentIndex - 1];
    const nextAssignment = remainingAssignments[assignmentIndex];

    // 撤销 B 后若形成 A -> A，删除后一条 A 并延长前一条，保持时间线简洁。
    if (
      previousAssignment &&
      nextAssignment &&
      previousAssignment.workLocation === nextAssignment.workLocation
    ) {
      await nextAssignment.deleteOne();
      remainingAssignments.splice(assignmentIndex, 1);
    }

    await this.rebuildTimeline(remainingAssignments);

    return { removed };
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

  async findByStudentIds(studentIds: string[]) {
    if (studentIds.length === 0) {
      return [];
    }

    if (studentIds.some((studentId) => !isValidObjectId(studentId))) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    const assignments = await this.assignmentModel
      .find({
        studentId: {
          $in: studentIds.map((studentId) => new Types.ObjectId(studentId)),
        },
      })
      .sort({ studentId: 1, effectiveFrom: 1 })
      .exec();

    return assignments.map((assignment) => this.toResponse(assignment));
  }

  async activateDueAssignments(referenceDate = new Date(), studentId?: string) {
    if (studentId && !isValidObjectId(studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    const assignments = await this.assignmentModel
      .find({
        effectiveFrom: { $lte: referenceDate },
        ...(studentId ? { studentId: new Types.ObjectId(studentId) } : {}),
      })
      .sort({ studentId: 1, effectiveFrom: -1 })
      .exec();
    const latestByStudent = new Map<string, WorkLocationAssignmentDocument>();

    for (const assignment of assignments) {
      const studentId = assignment.studentId.toString();
      if (!latestByStudent.has(studentId)) {
        latestByStudent.set(studentId, assignment);
      }
    }

    const results = await Promise.all(
      [...latestByStudent.values()].map((assignment) =>
        this.studentModel
          .updateOne(
            {
              _id: assignment.studentId,
              isDeleted: false,
            },
            { $set: { workLocation: assignment.workLocation } },
          )
          .exec(),
      ),
    );

    return {
      modifiedCount: results.reduce(
        (total, result) => total + result.modifiedCount,
        0,
      ),
    };
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

  private validateAssignmentId(assignmentId: string): void {
    if (!isValidObjectId(assignmentId)) {
      throw new BadRequestException('工作地点记录 ID 格式错误');
    }
  }

  private findStudentAssignments(studentId: string) {
    return this.assignmentModel
      .find({ studentId: new Types.ObjectId(studentId) })
      .sort({ effectiveFrom: 1 })
      .exec();
  }

  private async rebuildTimeline(
    assignments: WorkLocationAssignmentDocument[],
  ): Promise<void> {
    assignments.sort(
      (left, right) =>
        left.effectiveFrom.getTime() - right.effectiveFrom.getTime(),
    );

    // 先关闭前面的记录，最后再把末段设为开放，兼容“每名学生仅一条开放记录”的索引。
    for (let index = 0; index < assignments.length - 1; index += 1) {
      const assignment = assignments[index];
      const expectedEnd = assignments[index + 1].effectiveFrom;

      if (assignment.effectiveTo?.getTime() !== expectedEnd.getTime()) {
        assignment.effectiveTo = expectedEnd;
        await assignment.save();
      }
    }

    const finalAssignment = assignments.at(-1);
    if (finalAssignment && finalAssignment.effectiveTo !== null) {
      finalAssignment.effectiveTo = null;
      await finalAssignment.save();
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
