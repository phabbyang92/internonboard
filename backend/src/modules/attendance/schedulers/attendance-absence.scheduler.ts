import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { BusinessClockService } from '../../../common/time/business-clock.service';
import {
  OBSERVED_OPERATIONS,
  OperationMonitorService,
} from '../../../common/observability/operation-monitor.service';
import { AttendanceReconciliationService } from '../attendance-reconciliation.service';

@Injectable()
export class AttendanceAbsenceScheduler {
  private readonly logger = new Logger(AttendanceAbsenceScheduler.name);
  private readonly enabled: boolean;

  constructor(
    config: ConfigService,
    private readonly reconciliationService: AttendanceReconciliationService,
    private readonly businessClock: BusinessClockService,
    private readonly monitor: OperationMonitorService = new OperationMonitorService(),
  ) {
    const configuredValue = config.get<string>('ATTENDANCE_CRON_ENABLED');
    this.enabled = ['true', '1', 'yes', 'on'].includes(
      configuredValue?.trim().toLowerCase() ?? '',
    );
  }

  @Cron('0 1 11 * * 1-5', {
    name: 'daily-attendance-absence-reconciliation',
    timeZone: 'Asia/Shanghai',
    // 同一服务实例内，前一次补算未结束时不启动重叠任务。
    waitForCompletion: true,
  })
  async reconcileDailyAbsences(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const referenceNow = this.businessClock.now();
    const attendanceDate = this.businessClock.getBusinessDate(referenceNow);

    this.logger.log(
      `event=attendance_reconciliation_started trigger=cron ` +
        `attendanceDate=${attendanceDate} startedAt=${referenceNow.toISOString()}`,
    );
    const run = this.monitor.start(
      OBSERVED_OPERATIONS.AttendanceAbsenceCron,
      'cron',
    );

    try {
      const result = await this.reconciliationService.reconcileDate(
        attendanceDate,
        referenceNow,
      );
      this.monitor.succeed(run, {
        scannedCount: result.scannedCount,
        createdCount: result.createdCount,
        skippedCount: result.skippedCount,
        failedCount: result.failedCount,
      });

      const summary =
        `event=attendance_reconciliation_completed trigger=cron ` +
        `attendanceDate=${attendanceDate} ` +
        `startedAt=${result.startedAt.toISOString()}, ` +
        `completedAt=${result.completedAt.toISOString()}, ` +
        `scanned=${result.scannedCount}, created=${result.createdCount}, ` +
        `skipped=${result.skippedCount}, failed=${result.failedCount}`;

      if (result.failedCount > 0) {
        this.logger.warn(summary);
      } else {
        this.logger.log(summary);
      }
    } catch (error) {
      this.monitor.fail(run, error);
      const message = error instanceof Error ? error.message : '未知错误';
      this.logger.error(
        `event=attendance_reconciliation_failed trigger=cron ` +
          `attendanceDate=${attendanceDate} error=${message}`,
      );
      throw error;
    }
  }
}
