import {
  OBSERVED_OPERATIONS,
  OperationMonitorService,
} from './operation-monitor.service';

describe('OperationMonitorService', () => {
  it('records successful runs without business identifiers', () => {
    const service = new OperationMonitorService();
    const run = service.start(
      OBSERVED_OPERATIONS.AttendanceAbsenceCron,
      'cron',
    );

    service.succeed(run, { scannedCount: 8, createdCount: 3 });

    expect(service.getSnapshot()).toContainEqual(
      expect.objectContaining({
        operation: OBSERVED_OPERATIONS.AttendanceAbsenceCron,
        activeRuns: 0,
        totalRuns: 1,
        totalFailures: 0,
        lastStatus: 'success',
        lastTrigger: 'cron',
        lastMetrics: { scannedCount: 8, createdCount: 3 },
      }),
    );
  });

  it('records sanitized failures and resets the streak after success', () => {
    const service = new OperationMonitorService();
    const operation = OBSERVED_OPERATIONS.AttendanceQueryReconciliation;

    const failedRun = service.start(operation, 'query');
    service.fail(failedRun, new Error('database\n unavailable'));
    expect(service.getSnapshot()).toContainEqual(
      expect.objectContaining({
        operation,
        totalFailures: 1,
        consecutiveFailures: 1,
        lastStatus: 'failed',
        lastError: 'database unavailable',
      }),
    );

    const successfulRun = service.start(operation, 'query');
    service.succeed(successfulRun);
    expect(service.getSnapshot()).toContainEqual(
      expect.objectContaining({
        operation,
        consecutiveFailures: 0,
        lastStatus: 'success',
        lastError: null,
      }),
    );
  });
});
