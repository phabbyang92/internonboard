import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OperationMonitorService } from '../../common/observability/operation-monitor.service';
import { HrAuthGuard } from '../auth/guards/hr-auth.guard';
import type { AuthenticatedHrRequest } from '../auth/interfaces/authenticated-hr-request.interface';
import { RegionAccessService } from './access/region-access.service';

@Controller('hr/attendance/operations')
@UseGuards(HrAuthGuard)
export class AttendanceOperationsController {
  constructor(
    private readonly monitor: OperationMonitorService,
    private readonly regionAccessService: RegionAccessService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async getOperations(@Req() request: AuthenticatedHrRequest) {
    await this.regionAccessService.assertAdmin({
      hrUserId: request.hrUser.sub,
      role: request.hrUser.role,
    });

    return {
      generatedAt: new Date().toISOString(),
      attendanceCronEnabled:
        this.config.get<string>('ATTENDANCE_CRON_ENABLED') === 'true',
      // 该快照只包含计数和时间，不返回学生、附件或配置密钥。
      operations: this.monitor.getSnapshot(),
    };
  }
}
