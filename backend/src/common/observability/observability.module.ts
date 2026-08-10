import { Global, Module } from '@nestjs/common';
import { OperationMonitorService } from './operation-monitor.service';

@Global()
@Module({
  providers: [OperationMonitorService],
  exports: [OperationMonitorService],
})
export class ObservabilityModule {}
