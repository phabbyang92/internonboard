import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, QueryFilter } from 'mongoose';
import { isValidObjectId, Types } from 'mongoose';
import { BusinessClockService } from '../../common/time/business-clock.service';
import { OnboardingStatus } from '../student/enums/student.enums';
import {
  Student,
  type StudentDocument,
} from '../student/schemas/student.schema';
import { StudentService } from '../student/student.service';
import { AttendanceCalendarService } from './attendance-calendar.service';
import { ATTENDANCE_DATE_PATTERN } from './attendance.constants';
import { AttendanceSource } from './enums/attendance-source.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import type {
  AttendanceReconciliationCandidate,
  AttendanceReconciliationScanResult,
  AttendanceReconciliationWriteResult,
} from './interfaces/attendance-reconciliation-candidate.interface';
import type { AttendanceReconciliationResult } from './interfaces/attendance-reconciliation-result.interface';
import type { WorkdayResult } from './interfaces/workday-result.interface';
import { AttendanceLocationService } from './attendance-location.service';
import {
  AttendanceRecord,
  type AttendanceRecordDocument,
} from './schemas/attendance-record.schema';

const STUDENT_UNIQUE_INDEX = 'unique_student_attendance_date';

interface ReconciliationStudentRow {
  _id: Types.ObjectId;
  ownerHrId: Types.ObjectId;
}

interface ExistingAttendanceRow {
  studentId: Types.ObjectId;
}

@Injectable()
export class AttendanceReconciliationService {
  constructor(
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(AttendanceRecord.name)
    private readonly attendanceRecordModel: Model<AttendanceRecordDocument>,
    private readonly studentService: StudentService,
    private readonly businessClock: BusinessClockService,
    private readonly locationService: AttendanceLocationService,
    private readonly calendarService: AttendanceCalendarService,
  ) {}

  reconcileDate(
    attendanceDate: string,
    referenceNow: Date = this.businessClock.now(),
  ): Promise<AttendanceReconciliationResult> {
    return this.reconcileRange(attendanceDate, attendanceDate, referenceNow);
  }

  reconcileRange(
    startDate: string,
    endDate: string,
    referenceNow: Date = this.businessClock.now(),
  ): Promise<AttendanceReconciliationResult> {
    return this.prepareReconciliation(
      startDate,
      endDate,
      null,
      null,
      referenceNow,
    );
  }

  reconcileStudent(
    studentId: string,
    startDate: string,
    endDate: string,
    referenceNow: Date = this.businessClock.now(),
  ): Promise<AttendanceReconciliationResult> {
    if (!isValidObjectId(studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    return this.prepareReconciliation(
      startDate,
      endDate,
      studentId,
      null,
      referenceNow,
    );
  }

  reconcileOwner(
    ownerHrId: string,
    startDate: string,
    endDate: string,
    referenceNow: Date = this.businessClock.now(),
  ): Promise<AttendanceReconciliationResult> {
    if (!isValidObjectId(ownerHrId)) {
      throw new BadRequestException('负责 HR ID 格式错误');
    }

    return this.prepareReconciliation(
      startDate,
      endDate,
      null,
      ownerHrId,
      referenceNow,
    );
  }

  async scanCandidates(
    startDate: string,
    endDate: string,
    studentId: string | null = null,
    referenceNow: Date = this.businessClock.now(),
  ): Promise<AttendanceReconciliationScanResult> {
    return this.scanScopedCandidates(
      startDate,
      endDate,
      studentId,
      null,
      referenceNow,
    );
  }

  private async scanScopedCandidates(
    startDate: string,
    endDate: string,
    studentId: string | null,
    ownerHrId: string | null,
    referenceNow: Date,
  ): Promise<AttendanceReconciliationScanResult> {
    this.validateRange(startDate, endDate);

    if (studentId !== null && !isValidObjectId(studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    if (ownerHrId !== null && !isValidObjectId(ownerHrId)) {
      throw new BadRequestException('负责 HR ID 格式错误');
    }

    // 一批补算只刷新一次状态，避免按日期、按学生重复执行全表更新。
    await this.studentService.updateDueOnboardingStatuses(referenceNow);

    const result: AttendanceReconciliationScanResult = {
      startDate,
      endDate,
      studentId,
      scannedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      failures: [],
      candidates: [],
    };

    for (const attendanceDate of this.buildDateRange(startDate, endDate)) {
      const dateResult = await this.scanDate(
        attendanceDate,
        studentId,
        ownerHrId,
      );
      result.scannedCount += dateResult.scannedCount;
      result.skippedCount += dateResult.skippedCount;
      result.failedCount += dateResult.failedCount;
      result.failures.push(...dateResult.failures);
      result.candidates.push(...dateResult.candidates);
    }

    return result;
  }

  async writeAbsenceRecords(
    candidates: AttendanceReconciliationCandidate[],
    referenceNow: Date = this.businessClock.now(),
  ): Promise<AttendanceReconciliationWriteResult> {
    const result: AttendanceReconciliationWriteResult = {
      createdCount: 0,
      skippedCount: 0,
      failedCount: 0,
      failures: [],
    };

    for (const candidate of candidates) {
      if (
        !this.isReconciliationWindowClosed(
          candidate.attendanceDate,
          referenceNow,
        )
      ) {
        result.skippedCount += 1;
        continue;
      }

      try {
        const record = {
          studentId: new Types.ObjectId(candidate.studentId),
          ownerHrId: new Types.ObjectId(candidate.ownerHrId),
          attendanceDate: candidate.attendanceDate,
          status: AttendanceStatus.Absent,
          lateLevel: null,
          source: AttendanceSource.AbsenceScheduler,
          checkInAt: null,
          checkInAttemptAt: null,
          assignedWorkLocation: candidate.assignedWorkLocation,
          assignedWorkLocationAssignmentId: new Types.ObjectId(
            candidate.assignedWorkLocationAssignmentId,
          ),
          checkInMode: null,
          checkInLocation: null,
          deviceIdHash: null,
          matchedOfficeNetworkId: null,
          ipMatchSucceeded: null,
          leaveBatchId: null,
          leaveRegisteredAt: null,
          createdAt: referenceNow,
          updatedAt: referenceNow,
        };
        const writeResult = await this.attendanceRecordModel
          .updateOne(
            {
              studentId: record.studentId,
              attendanceDate: record.attendanceDate,
            },
            { $setOnInsert: record },
            // 避免命中既有人工记录时仅因 Mongoose timestamps 改写 updatedAt。
            { upsert: true, timestamps: false },
          )
          .exec();

        // matchedCount 表示签到、请假、缺勤或人工更正已经存在，不能覆盖。
        if (writeResult.upsertedCount === 1) {
          result.createdCount += 1;
        } else {
          result.skippedCount += 1;
        }
      } catch (error) {
        // 两个补算请求可能同时看见空记录；唯一索引决定最终只插入一条。
        if (this.isStudentDuplicateKeyError(error)) {
          result.skippedCount += 1;
          continue;
        }

        result.failedCount += 1;
        result.failures.push({
          studentId: candidate.studentId,
          attendanceDate: candidate.attendanceDate,
          message: error instanceof Error ? error.message : '缺勤记录写入失败',
        });
      }
    }

    return result;
  }

  private async prepareReconciliation(
    startDate: string,
    endDate: string,
    studentId: string | null,
    ownerHrId: string | null,
    startedAt: Date,
  ): Promise<AttendanceReconciliationResult> {
    const scan = await this.scanScopedCandidates(
      startDate,
      endDate,
      studentId,
      ownerHrId,
      startedAt,
    );
    const write = await this.writeAbsenceRecords(scan.candidates, startedAt);

    return {
      startDate,
      endDate,
      studentId,
      startedAt,
      completedAt: this.businessClock.now(),
      scannedCount: scan.scannedCount,
      createdCount: write.createdCount,
      skippedCount: scan.skippedCount + write.skippedCount,
      failedCount: scan.failedCount + write.failedCount,
      failures: [...scan.failures, ...write.failures],
    };
  }

  private isReconciliationWindowClosed(
    attendanceDate: string,
    referenceNow: Date,
  ): boolean {
    const today = this.businessClock.getBusinessDate(referenceNow);

    if (attendanceDate < today) {
      return true;
    }

    if (attendanceDate > today) {
      return false;
    }

    return this.businessClock.getAttendanceWindow(referenceNow) === 'closed';
  }

  private isStudentDuplicateKeyError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const mongoError = error as {
      code?: unknown;
      keyPattern?: Record<string, unknown>;
      message?: unknown;
    };

    if (mongoError.code !== 11000) {
      return false;
    }

    return (
      mongoError.keyPattern?.studentId === 1 ||
      (typeof mongoError.message === 'string' &&
        mongoError.message.includes(STUDENT_UNIQUE_INDEX))
    );
  }

  private async scanDate(
    attendanceDate: string,
    studentId: string | null,
    ownerHrId: string | null,
  ): Promise<AttendanceReconciliationScanResult> {
    const { dayStart, nextDayStart } = this.getBusinessDayRange(attendanceDate);
    const filter: QueryFilter<Student> = {
      isDeleted: false,
      onboardingStatus: {
        $in: [OnboardingStatus.Onboarded, OnboardingStatus.Departed],
      },
      onboardingStartAt: { $ne: null, $lt: nextDayStart },
      $or: [{ onboardingEndAt: null }, { onboardingEndAt: { $gte: dayStart } }],
    };

    if (studentId !== null) {
      filter._id = new Types.ObjectId(studentId);
    }

    if (ownerHrId !== null) {
      filter.ownerHrId = new Types.ObjectId(ownerHrId);
    }

    const students = (await this.studentModel
      .find(filter)
      .select({ _id: 1, ownerHrId: 1 })
      .lean()
      .exec()) as ReconciliationStudentRow[];
    const result: AttendanceReconciliationScanResult = {
      startDate: attendanceDate,
      endDate: attendanceDate,
      studentId,
      scannedCount: students.length,
      skippedCount: 0,
      failedCount: 0,
      failures: [],
      candidates: [],
    };

    if (students.length === 0) {
      return result;
    }

    const existingRecords = (await this.attendanceRecordModel
      .find({
        attendanceDate,
        studentId: { $in: students.map((student) => student._id) },
      })
      .select({ studentId: 1 })
      .lean()
      .exec()) as ExistingAttendanceRow[];
    const existingStudentIds = new Set(
      existingRecords.map((record) => record.studentId.toString()),
    );
    const workdayByRegion = new Map<string, Promise<WorkdayResult>>();

    for (const student of students) {
      const candidate = await this.evaluateCandidate(
        student,
        attendanceDate,
        existingStudentIds,
        workdayByRegion,
        result,
      );

      if (candidate) {
        result.candidates.push(candidate);
      }
    }

    return result;
  }

  private async evaluateCandidate(
    student: ReconciliationStudentRow,
    attendanceDate: string,
    existingStudentIds: Set<string>,
    workdayByRegion: Map<string, Promise<WorkdayResult>>,
    result: AttendanceReconciliationScanResult,
  ): Promise<AttendanceReconciliationCandidate | null> {
    const studentId = student._id.toString();

    if (existingStudentIds.has(studentId)) {
      result.skippedCount += 1;
      return null;
    }

    try {
      const location = await this.locationService.findEffectiveLocation(
        studentId,
        attendanceDate,
      );

      if (!location) {
        result.skippedCount += 1;
        return null;
      }

      let workdayPromise = workdayByRegion.get(location.regionCode);

      if (!workdayPromise) {
        workdayPromise = this.calendarService.isWorkday(
          attendanceDate,
          location.regionCode,
        );
        workdayByRegion.set(location.regionCode, workdayPromise);
      }

      const workday = await workdayPromise;

      if (!workday.isWorkday) {
        result.skippedCount += 1;
        return null;
      }

      if (!student.ownerHrId) {
        throw new Error('学生缺少负责 HR');
      }

      return {
        studentId,
        ownerHrId: student.ownerHrId.toString(),
        attendanceDate,
        assignedWorkLocation: location.workLocation,
        assignedWorkLocationAssignmentId: location.assignmentId,
      };
    } catch (error) {
      result.failedCount += 1;
      result.failures.push({
        studentId,
        attendanceDate,
        message: error instanceof Error ? error.message : '候选学生扫描失败',
      });
      return null;
    }
  }

  private validateRange(startDate: string, endDate: string): void {
    this.parseAttendanceDate(startDate);
    this.parseAttendanceDate(endDate);

    if (startDate > endDate) {
      throw new BadRequestException('补算开始日期不能晚于结束日期');
    }
  }

  private buildDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const cursor = this.parseAttendanceDate(startDate);
    const lastDate = this.parseAttendanceDate(endDate);

    while (cursor <= lastDate) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return dates;
  }

  private getBusinessDayRange(attendanceDate: string): {
    dayStart: Date;
    nextDayStart: Date;
  } {
    const dayStart = new Date(`${attendanceDate}T00:00:00+08:00`);

    return {
      dayStart,
      nextDayStart: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000),
    };
  }

  private parseAttendanceDate(attendanceDate: string): Date {
    if (!ATTENDANCE_DATE_PATTERN.test(attendanceDate)) {
      throw new BadRequestException('补算日期格式必须为 YYYY-MM-DD');
    }

    const [year, month, day] = attendanceDate.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException('补算日期无效');
    }

    return date;
  }
}
