import { Injectable } from '@nestjs/common';
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

  async createStudent(dto: CreateStudentDto, hrUserId: string) {
    const result = await this.studentService.create(dto);

    await this.operationLogService.record({
      operatorHrId: hrUserId,
      studentId: result.id,
      action: OperationAction.StudentCreated,

      // 日志记录创建动作和字段，不复制姓名、邮箱、手机号等个人信息。
      changes: {
        fields: ['name', 'email', ...(dto.phone ? ['phone'] : [])],
      },
    });

    return result;
  }

  async updateProfile(
    studentId: string,
    dto: UpdateStudentProfileDto,
    hrUserId: string,
  ) {
    const result = await this.studentService.updateProfile(
      studentId,
      dto,
      hrUserId,
    );

    await this.operationLogService.record({
      operatorHrId: hrUserId,
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
    hrUserId: string,
  ) {
    // 修改前读取旧值，操作日志才能记录 before -> after。
    const before = await this.studentService.findOneById(studentId);

    if (
      before.workLocation &&
      (dto.workLocation !== undefined || dto.onboardingStartAt !== undefined)
    ) {
      // 为系统升级前已经存在的地点补一条起始记录；已有记录时不会重复。
      await this.workLocationHistoryService.recordAssignment({
        studentId,
        workLocation: before.workLocation,
        onboardingStartAt: before.onboardingStartAt,
        changedByHrId: hrUserId,
        source: WorkLocationAssignmentSource.Backfill,
      });
    }

    const result = await this.studentService.updateArrangement(
      studentId,
      dto,
      hrUserId,
    );

    if (
      result.workLocation &&
      (dto.workLocation !== undefined || dto.onboardingStartAt !== undefined)
    ) {
      await this.workLocationHistoryService.recordAssignment({
        studentId,
        workLocation: result.workLocation,
        onboardingStartAt: result.onboardingStartAt,
        changedByHrId: hrUserId,
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
      operatorHrId: hrUserId,
      studentId,
      action: OperationAction.StudentArrangementUpdated,
      changes,
    });

    return result;
  }

  async batchUpdateArrangement(
    dto: BatchUpdateStudentArrangementDto,
    hrUserId: string,
  ) {
    // 修改前读取旧安排，使每位学生都有独立的 before -> after 日志。
    const studentsBeforeUpdate = await Promise.all(
      dto.studentIds.map((studentId) =>
        this.studentService.findOneById(studentId),
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
          changedByHrId: hrUserId,
          source: WorkLocationAssignmentSource.Backfill,
        });
      }),
    );

    const result = await this.studentService.batchUpdateArrangement(
      dto,
      hrUserId,
    );

    await Promise.all(
      dto.studentIds.map((studentId) =>
        this.workLocationHistoryService.recordAssignment({
          studentId,
          workLocation: result.workLocation,
          onboardingStartAt: result.onboardingStartAt,
          changedByHrId: hrUserId,
          source: WorkLocationAssignmentSource.Batch,
        }),
      ),
    );

    await Promise.all(
      studentsBeforeUpdate.map((student, index) =>
        this.operationLogService.record({
          operatorHrId: hrUserId,
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

  async getWorkLocationHistory(studentId: string) {
    // 先确认学生存在且没有被软删除。
    await this.studentService.findOneById(studentId);

    return {
      items: await this.workLocationHistoryService.findByStudentId(studentId),
    };
  }

  async getOperationLogs(studentId: string, query: ListOperationLogsQueryDto) {
    // 操作日志需要支持查询已软删除学生，因此不能使用只查 active 的方法。
    await this.studentService.ensureStudentExistsIncludingDeleted(studentId);
    return this.operationLogService.findByStudentId(studentId, query);
  }

  async softDeleteStudent(
    studentId: string,
    dto: SoftDeleteStudentDto,
    hrUserId: string,
  ) {
    const before = await this.studentService.findOneById(studentId);
    const result = await this.studentService.softDelete(studentId, hrUserId);

    // 删除学生后关闭尚未结束的地点安排，供未来出勤统计正确判断。
    await this.workLocationHistoryService.closeCurrentAssignment(
      studentId,
      result.deletedAt,
    );

    await this.operationLogService.record({
      operatorHrId: hrUserId,
      studentId,
      action: OperationAction.StudentSoftDeleted,
      changes: {
        reason: dto.reason?.trim() || null,
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
