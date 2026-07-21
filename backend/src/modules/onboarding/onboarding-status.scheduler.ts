import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StudentService } from '../student/student.service';

@Injectable()
export class OnboardingStatusScheduler {
  private readonly logger = new Logger(OnboardingStatusScheduler.name);

  constructor(private readonly studentService: StudentService) {}

  @Cron('0 5 0 * * *', {
    name: 'daily-onboarding-status-update',
    timeZone: 'Asia/Shanghai',
    // 同一实例内如果前一次任务仍未结束，不启动重叠任务。
    waitForCompletion: true,
  })
  async updateDueOnboardingStatuses(): Promise<void> {
    const result = await this.studentService.updateDueOnboardingStatuses();

    this.logger.log(
      `Daily onboarding status update completed: ${result.modifiedCount} students updated`,
    );
  }
}
