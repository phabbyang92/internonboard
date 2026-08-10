import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StudentService } from '../student/student.service';
import { WorkLocationHistoryService } from '../work-location/work-location-history.service';
import {
  OBSERVED_OPERATIONS,
  OperationMonitorService,
} from '../../common/observability/operation-monitor.service';

@Injectable()
export class OnboardingStatusScheduler {
  private readonly logger = new Logger(OnboardingStatusScheduler.name);

  constructor(
    private readonly studentService: StudentService,
    private readonly workLocationHistoryService: WorkLocationHistoryService,
    private readonly monitor: OperationMonitorService = new OperationMonitorService(),
  ) {}

  @Cron('0 5 0 * * *', {
    name: 'daily-onboarding-status-update',
    timeZone: 'Asia/Shanghai',
    // 同一实例内如果前一次任务仍未结束，不启动重叠任务。
    waitForCompletion: true,
  })
  async updateDueOnboardingStatuses(): Promise<void> {
    const run = this.monitor.start(
      OBSERVED_OPERATIONS.OnboardingStatusCron,
      'cron',
    );

    this.logger.log('event=onboarding_status_update_started trigger=cron');

    try {
      const result = await this.studentService.updateDueOnboardingStatuses();
      const locationResult =
        await this.workLocationHistoryService.activateDueAssignments();

      this.monitor.succeed(run, {
        modifiedCount: result.modifiedCount + locationResult.modifiedCount,
      });

      this.logger.log(
        `event=onboarding_status_update_completed trigger=cron ` +
          `statusesModified=${result.modifiedCount} ` +
          `locationsModified=${locationResult.modifiedCount}`,
      );
    } catch (error) {
      this.monitor.fail(run, error);
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(
        `event=onboarding_status_update_failed trigger=cron error=${message}`,
      );
      throw error;
    }
  }
}
