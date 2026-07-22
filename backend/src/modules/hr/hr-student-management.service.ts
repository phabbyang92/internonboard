import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { OperationAction } from '../operation-log/enums/operation-action.enum';
import { OperationLogService } from '../operation-log/operation-log.service';
import { BatchUpdateStudentArrangementDto } from '../student/dto/batch-update-student-arrangement.dto';
import { CreateStudentDto } from '../student/dto/create-student.dto';
import { ListStudentsQueryDto } from '../student/dto/list-students-query.dto';
import { UpdateStudentArrangementDto } from '../student/dto/update-student-arrangement.dto';
import { OnboardingStatus } from '../student/enums/student.enums';
import { StudentService } from '../student/student.service';
import { WorkLocationAssignmentSource } from '../work-location/work-location-assignment-source.enum';
import { WorkLocationHistoryService } from '../work-location/work-location-history.service';
import { ChangeStudentWorkLocationDto } from './dto/change-student-work-location.dto';
import { ListOperationLogsQueryDto } from './dto/list-operation-logs-query.dto';
import { SoftDeleteStudentDto } from './dto/soft-delete-student.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { UpdateWorkLocationAssignmentDto } from './dto/update-work-location-assignment.dto';

@Injectable()
export class HrStudentManagementService {
  constructor(
    private readonly studentService: StudentService,
    private readonly operationLogService: OperationLogService,
    private readonly workLocationHistoryService: WorkLocationHistoryService,
  ) {}

  async findAll(query: ListStudentsQueryDto, access: HrAccessContext) {
    await this.workLocationHistoryService.activateDueAssignments();
    const result = await this.studentService.findAll(query, access);
    const histories = await this.workLocationHistoryService.findByStudentIds(
      result.items.map((student) => student.id),
    );
    const historyByStudent = new Map<
      string,
      Array<{
        workLocation: string;
        effectiveFrom: Date;
        effectiveTo: Date | null;
      }>
    >();

    for (const history of histories) {
      const studentHistory = historyByStudent.get(history.studentId) ?? [];
      studentHistory.push({
        workLocation: history.workLocation,
        effectiveFrom: history.effectiveFrom,
        effectiveTo: history.effectiveTo,
      });
      historyByStudent.set(history.studentId, studentHistory);
    }

    return {
      ...result,
      items: result.items.map((student) => {
        const timeline = historyByStudent.get(student.id) ?? [];

        return {
          ...student,
          // 旧学生可能还没有历史集合，列表先用当前安排构造第一段。
          workLocationTimeline:
            timeline.length > 0
              ? timeline
              : student.workLocation && student.onboardingStartAt
                ? [
                    {
                      workLocation: student.workLocation,
                      effectiveFrom: student.onboardingStartAt,
                      effectiveTo: null,
                    },
                  ]
                : [],
        };
      }),
    };
  }

  async createStudent(dto: CreateStudentDto, access: HrAccessContext) {
    const result = await this.studentService.create(dto, access.hrUserId);

    if (result.workLocation && result.onboardingStartAt) {
      await this.workLocationHistoryService.recordAssignment({
        studentId: result.id,
        workLocation: result.workLocation,
        onboardingStartAt: result.onboardingStartAt,
        changedByHrId: access.hrUserId,
        source: WorkLocationAssignmentSource.Create,
      });
    }

    await this.operationLogService.record({
      operatorHrId: access.hrUserId,
      studentId: result.id,
      action: OperationAction.StudentCreated,

      // 日志记录创建动作和字段，不复制姓名、邮箱、手机号等个人信息。
      changes: {
        fields: [
          'name',
          'email',
          ...(dto.phone ? ['phone'] : []),
          ...(result.workLocation
            ? ['workLocation', 'onboardingStartAt', 'onboardingStatus']
            : []),
        ],
        ownerHrId: access.hrUserId,
      },
    });

    return result;
  }

  async updateProfile(
    studentId: string,
    dto: UpdateStudentProfileDto,
    access: HrAccessContext,
  ) {
    const result = await this.studentService.updateProfile(
      studentId,
      dto,
      access,
    );

    await this.operationLogService.record({
      operatorHrId: access.hrUserId,
      studentId,
      action: OperationAction.StudentProfileUpdated,

      // 登记信息可能包含身份证号，因此日志只记录字段名。
      changes: {
        fields: this.getUpdatedProfileFields(dto),
      },
    });

    return result;
  }

  async updateArrangement(
    studentId: string,
    dto: UpdateStudentArrangementDto,
    access: HrAccessContext,
  ) {
    // 修改前读取旧值，操作日志才能记录 before -> after。
    const before = await this.studentService.findOneByIdForHr(
      studentId,
      access,
    );

    if (
      before.workLocation &&
      (dto.workLocation !== undefined || dto.onboardingStartAt !== undefined)
    ) {
      // 为系统升级前已经存在的地点补一条起始记录；已有记录时不会重复。
      await this.workLocationHistoryService.recordAssignment({
        studentId,
        workLocation: before.workLocation,
        onboardingStartAt: before.onboardingStartAt,
        changedByHrId: access.hrUserId,
        source: WorkLocationAssignmentSource.Backfill,
      });
    }

    const result = await this.studentService.updateArrangement(
      studentId,
      dto,
      access,
    );

    if (
      result.workLocation &&
      (dto.workLocation !== undefined || dto.onboardingStartAt !== undefined)
    ) {
      await this.workLocationHistoryService.recordAssignment({
        studentId,
        workLocation: result.workLocation,
        onboardingStartAt: result.onboardingStartAt,
        changedByHrId: access.hrUserId,
        source: WorkLocationAssignmentSource.Single,
      });
    }

    const changes: Record<string, unknown> = {};

    if (dto.workLocation !== undefined) {
      changes.workLocation = {
        before: before.workLocation,
        after: result.workLocation,
      };
    }

    if (dto.onboardingStartAt !== undefined) {
      changes.onboardingStartAt = {
        before: before.onboardingStartAt,
        after: result.onboardingStartAt,
      };
    }

    if (dto.onboardingEndAt !== undefined) {
      changes.onboardingEndAt = {
        before: before.onboardingEndAt,
        after: result.onboardingEndAt,
      };
    }

    await this.operationLogService.record({
      operatorHrId: access.hrUserId,
      studentId,
      action: OperationAction.StudentArrangementUpdated,
      changes,
    });

    return result;
  }

  async batchUpdateArrangement(
    dto: BatchUpdateStudentArrangementDto,
    access: HrAccessContext,
  ) {
    // 修改前读取旧安排，使每位学生都有独立的 before -> after 日志。
    const studentsBeforeUpdate = await Promise.all(
      dto.studentIds.map((studentId) =>
        this.studentService.findOneByIdForHr(studentId, access),
      ),
    );

    await Promise.all(
      studentsBeforeUpdate.map((student, index) => {
        if (!student.workLocation) {
          return Promise.resolve();
        }

        return this.workLocationHistoryService.recordAssignment({
          studentId: dto.studentIds[index],
          workLocation: student.workLocation,
          onboardingStartAt: student.onboardingStartAt,
          changedByHrId: access.hrUserId,
          source: WorkLocationAssignmentSource.Backfill,
        });
      }),
    );

    const result = await this.studentService.batchUpdateArrangement(
      dto,
      access,
    );

    await Promise.all(
      dto.studentIds.map((studentId) =>
        this.workLocationHistoryService.recordAssignment({
          studentId,
          workLocation: result.workLocation,
          onboardingStartAt: result.onboardingStartAt,
          changedByHrId: access.hrUserId,
          source: WorkLocationAssignmentSource.Batch,
        }),
      ),
    );

    await Promise.all(
      studentsBeforeUpdate.map((student, index) =>
        this.operationLogService.record({
          operatorHrId: access.hrUserId,
          studentId: dto.studentIds[index],
          action: OperationAction.StudentArrangementUpdated,
          changes: {
            source: 'batch',
            workLocation: {
              before: student.workLocation,
              after: result.workLocation,
            },
            onboardingStartAt: {
              before: student.onboardingStartAt,
              after: result.onboardingStartAt,
            },
            onboardingStatus: {
              before: student.onboardingStatus,
              after: result.onboardingStatus,
            },
          },
        }),
      ),
    );

    return result;
  }

  async changeWorkLocation(
    studentId: string,
    dto: ChangeStudentWorkLocationDto,
    access: HrAccessContext,
  ) {
    // 详情页可能长时间未刷新，先同步到期状态再判断是否已入职。
    await this.studentService.updateDueOnboardingStatuses();
    const before = await this.studentService.findOneByIdForHr(
      studentId,
      access,
    );

    if (
      before.onboardingStatus !== OnboardingStatus.Onboarded &&
      before.onboardingStatus !== OnboardingStatus.Departed
    ) {
      throw new ConflictException('学生入职后才能新增工作地点变更记录');
    }

    if (!before.workLocation || !before.onboardingStartAt) {
      throw new BadRequestException('学生尚未设置初始工作地点和开始日期');
    }

    const effectiveFrom = this.normalizeChinaDate(dto.effectiveFrom);

    const chinaToday = this.normalizeChinaDate(new Date().toISOString());

    // 系统升级前的学生可能没有首段历史；已有时间线时不能重复回填。
    const existingHistory =
      await this.workLocationHistoryService.findByStudentId(studentId);
    if (existingHistory.length === 0) {
      await this.workLocationHistoryService.recordAssignment({
        studentId,
        workLocation: before.workLocation,
        onboardingStartAt: before.onboardingStartAt,
        changedByHrId: access.hrUserId,
        source: WorkLocationAssignmentSource.Backfill,
      });
    }

    const previousStartAt = existingHistory[0]?.effectiveFrom
      ? this.normalizeChinaDate(existingHistory[0].effectiveFrom.toISOString())
      : this.normalizeChinaDate(before.onboardingStartAt.toISOString());

    if (effectiveFrom <= previousStartAt) {
      throw new BadRequestException('新地点开始日期必须晚于上一段实习开始日期');
    }

    const assignment = await this.workLocationHistoryService.changeLocation({
      studentId,
      workLocation: dto.workLocation,
      effectiveFrom,
      changedByHrId: access.hrUserId,
    });
    await this.workLocationHistoryService.activateDueAssignments(
      chinaToday,
      studentId,
    );
    const student = await this.studentService.findOneByIdForHr(
      studentId,
      access,
    );

    await this.operationLogService.record({
      operatorHrId: access.hrUserId,
      studentId,
      action: OperationAction.StudentArrangementUpdated,
      changes: {
        workLocation: {
          before: before.workLocation,
          after: dto.workLocation,
        },
        effectiveFrom,
      },
    });

    return { student, assignment };
  }

  async getWorkLocationHistory(studentId: string, access: HrAccessContext) {
    // 先确认学生存在且没有被软删除。
    await this.studentService.findOneByIdForHr(studentId, access);

    return {
      items: await this.workLocationHistoryService.findByStudentId(studentId),
    };
  }

  async updateWorkLocationAssignment(
    studentId: string,
    assignmentId: string,
    dto: UpdateWorkLocationAssignmentDto,
    access: HrAccessContext,
  ) {
    await this.studentService.findOneByIdForHr(studentId, access);

    const result = await this.workLocationHistoryService.updateAssignment({
      studentId,
      assignmentId,
      workLocation: dto.workLocation,
      effectiveFrom: this.normalizeChinaDate(dto.effectiveFrom),
      changedByHrId: access.hrUserId,
    });

    const chinaToday = this.normalizeChinaDate(new Date().toISOString());
    await this.workLocationHistoryService.activateDueAssignments(
      chinaToday,
      studentId,
    );

    await this.operationLogService.record({
      operatorHrId: access.hrUserId,
      studentId,
      action: OperationAction.WorkLocationAssignmentUpdated,
      changes: {
        assignmentId,
        workLocation: {
          before: result.before.workLocation,
          after: result.assignment.workLocation,
        },
        effectiveFrom: {
          before: result.before.effectiveFrom,
          after: result.assignment.effectiveFrom,
        },
      },
    });

    return {
      message: '工作地点记录修改成功',
      assignment: result.assignment,
    };
  }

  async cancelWorkLocationAssignment(
    studentId: string,
    assignmentId: string,
    access: HrAccessContext,
  ) {
    await this.studentService.findOneByIdForHr(studentId, access);

    const result = await this.workLocationHistoryService.removeAssignment({
      studentId,
      assignmentId,
    });

    const chinaToday = this.normalizeChinaDate(new Date().toISOString());
    await this.workLocationHistoryService.activateDueAssignments(
      chinaToday,
      studentId,
    );

    await this.operationLogService.record({
      operatorHrId: access.hrUserId,
      studentId,
      action: OperationAction.WorkLocationAssignmentCancelled,
      changes: {
        assignmentId,
        workLocation: result.removed.workLocation,
        effectiveFrom: result.removed.effectiveFrom,
      },
    });

    return { message: '工作地点记录已撤销' };
  }

  async getOperationLogs(
    studentId: string,
    query: ListOperationLogsQueryDto,
    access: HrAccessContext,
  ) {
    // 操作日志需要支持查询已软删除学生，因此不能使用只查 active 的方法。
    await this.studentService.ensureStudentExistsIncludingDeletedForHr(
      studentId,
      access,
    );
    return this.operationLogService.findByStudentId(studentId, query);
  }

  async softDeleteStudent(
    studentId: string,
    dto: SoftDeleteStudentDto,
    access: HrAccessContext,
  ) {
    const before = await this.studentService.findOneByIdForHr(
      studentId,
      access,
    );
    const result = await this.studentService.softDelete(studentId, access);

    // 删除学生后关闭尚未结束的地点安排，供未来出勤统计正确判断。
    await this.workLocationHistoryService.closeCurrentAssignment(
      studentId,
      result.deletedAt,
    );

    await this.operationLogService.record({
      operatorHrId: access.hrUserId,
      studentId,
      action: OperationAction.StudentSoftDeleted,
      changes: {
        // DELETE 请求可以不携带 body，因此这里使用可选链保护。
        reason: dto?.reason?.trim() || null,
        previousOnboardingStatus: before.onboardingStatus,
        previousWorkLocation: before.workLocation,
      },
    });

    return {
      message: '学生已删除',
      ...result,
    };
  }

  private getUpdatedProfileFields(dto: UpdateStudentProfileDto): string[] {
    const fields: string[] = [];

    for (const field of Object.keys(dto)) {
      if (field !== 'basicInfo') {
        fields.push(field);
      }
    }

    if (dto.basicInfo) {
      for (const field of Object.keys(dto.basicInfo)) {
        fields.push(`basicInfo.${field}`);
      }
    }

    return fields;
  }

  private normalizeChinaDate(value: string): Date {
    const inputDate = new Date(value);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(inputDate);
    const getPart = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';

    return new Date(
      `${getPart('year')}-${getPart('month')}-${getPart('day')}T00:00:00+08:00`,
    );
  }
}
