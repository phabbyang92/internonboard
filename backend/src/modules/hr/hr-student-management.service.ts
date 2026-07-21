import { Injectable } from '@nestjs/common';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { OperationAction } from '../operation-log/enums/operation-action.enum';
import { OperationLogService } from '../operation-log/operation-log.service';
import { BatchUpdateStudentArrangementDto } from '../student/dto/batch-update-student-arrangement.dto';
import { CreateStudentDto } from '../student/dto/create-student.dto';
import { UpdateStudentArrangementDto } from '../student/dto/update-student-arrangement.dto';
import { StudentService } from '../student/student.service';
import { WorkLocationAssignmentSource } from '../work-location/work-location-assignment-source.enum';
import { WorkLocationHistoryService } from '../work-location/work-location-history.service';
import { ListOperationLogsQueryDto } from './dto/list-operation-logs-query.dto';
import { SoftDeleteStudentDto } from './dto/soft-delete-student.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';

@Injectable()
export class HrStudentManagementService {
  constructor(
    private readonly studentService: StudentService,
    private readonly operationLogService: OperationLogService,
    private readonly workLocationHistoryService: WorkLocationHistoryService,
  ) {}

  async createStudent(dto: CreateStudentDto, access: HrAccessContext) {
    const result = await this.studentService.create(dto, access.hrUserId);

    await this.operationLogService.record({
      operatorHrId: access.hrUserId,
      studentId: result.id,
      action: OperationAction.StudentCreated,

      // 日志记录创建动作和字段，不复制姓名、邮箱、手机号等个人信息。
      changes: {
        fields: ['name', 'email', ...(dto.phone ? ['phone'] : [])],
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

  async getWorkLocationHistory(studentId: string, access: HrAccessContext) {
    // 先确认学生存在且没有被软删除。
    await this.studentService.findOneByIdForHr(studentId, access);

    return {
      items: await this.workLocationHistoryService.findByStudentId(studentId),
    };
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
}
