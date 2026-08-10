import { BadRequestException, Injectable } from '@nestjs/common';
import { BusinessClockService } from '../../common/time/business-clock.service';
import {
  OBSERVED_OPERATIONS,
  OperationMonitorService,
} from '../../common/observability/operation-monitor.service';
import { HrRole } from '../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import type { AttendanceReconciliationResult } from './interfaces/attendance-reconciliation-result.interface';
import { AttendanceReconciliationService } from './attendance-reconciliation.service';

const ATTENDANCE_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

interface QueryMonthRange {
  startDate: string;
  endDate: string;
}

@Injectable()
export class AttendanceQueryPreparationService {
  constructor(
    private readonly reconciliationService: AttendanceReconciliationService,
    private readonly businessClock: BusinessClockService,
    private readonly monitor: OperationMonitorService = new OperationMonitorService(),
  ) {}

  prepareHrDaily(
    attendanceDate: string,
    access: HrAccessContext,
    referenceNow: Date = this.businessClock.now(),
    requestedOwnerHrId: string | null = null,
  ): Promise<AttendanceReconciliationResult> {
    const ownerHrId =
      requestedOwnerHrId ??
      (access.role === HrRole.Admin ? null : access.hrUserId);

    if (ownerHrId === null) {
      return this.trackReconciliation(() =>
        this.reconciliationService.reconcileDate(attendanceDate, referenceNow),
      );
    }

    // 普通 HR 或 Admin 的负责人筛选只补算该负责人的学生。
    return this.trackReconciliation(() =>
      this.reconciliationService.reconcileOwner(
        ownerHrId,
        attendanceDate,
        attendanceDate,
        referenceNow,
      ),
    );
  }

  prepareHrMonth(
    month: string,
    access: HrAccessContext,
    referenceNow: Date = this.businessClock.now(),
    requestedOwnerHrId: string | null = null,
  ): Promise<AttendanceReconciliationResult | null> {
    const range = this.getReconciliationMonthRange(month, referenceNow);

    if (!range) {
      return Promise.resolve(null);
    }

    const ownerHrId =
      requestedOwnerHrId ??
      (access.role === HrRole.Admin ? null : access.hrUserId);

    if (ownerHrId === null) {
      return this.trackReconciliation(() =>
        this.reconciliationService.reconcileRange(
          range.startDate,
          range.endDate,
          referenceNow,
        ),
      );
    }

    return this.trackReconciliation(() =>
      this.reconciliationService.reconcileOwner(
        ownerHrId,
        range.startDate,
        range.endDate,
        referenceNow,
      ),
    );
  }

  prepareStudentMonth(
    studentId: string,
    month: string,
    referenceNow: Date = this.businessClock.now(),
  ): Promise<AttendanceReconciliationResult | null> {
    const range = this.getReconciliationMonthRange(month, referenceNow);

    if (!range) {
      return Promise.resolve(null);
    }

    return this.trackReconciliation(() =>
      this.reconciliationService.reconcileStudent(
        studentId,
        range.startDate,
        range.endDate,
        referenceNow,
      ),
    );
  }

  prepareStudentDaily(
    studentId: string,
    attendanceDate: string,
    referenceNow: Date = this.businessClock.now(),
  ): Promise<AttendanceReconciliationResult> {
    return this.trackReconciliation(() =>
      this.reconciliationService.reconcileStudent(
        studentId,
        attendanceDate,
        attendanceDate,
        referenceNow,
      ),
    );
  }

  private async trackReconciliation(
    execute: () => Promise<AttendanceReconciliationResult>,
  ): Promise<AttendanceReconciliationResult> {
    const run = this.monitor.start(
      OBSERVED_OPERATIONS.AttendanceQueryReconciliation,
      'query',
    );

    try {
      const result = await execute();
      this.monitor.succeed(run, {
        scannedCount: result.scannedCount,
        createdCount: result.createdCount,
        skippedCount: result.skippedCount,
        failedCount: result.failedCount,
      });
      return result;
    } catch (error) {
      this.monitor.fail(run, error);
      throw error;
    }
  }

  private getReconciliationMonthRange(
    month: string,
    referenceNow: Date,
  ): QueryMonthRange | null {
    if (!ATTENDANCE_MONTH_PATTERN.test(month)) {
      throw new BadRequestException('查询月份格式必须为 YYYY-MM');
    }

    const [year, monthNumber] = month.split('-').map(Number);
    const startDate = `${month}-01`;
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const monthEndDate = `${month}-${String(lastDay).padStart(2, '0')}`;
    const today = this.businessClock.getBusinessDate(referenceNow);

    // 未来月份没有可能需要补齐的缺勤，读取接口可以直接查询空记录。
    if (startDate > today) {
      return null;
    }

    return {
      startDate,
      endDate: monthEndDate > today ? today : monthEndDate,
    };
  }
}
