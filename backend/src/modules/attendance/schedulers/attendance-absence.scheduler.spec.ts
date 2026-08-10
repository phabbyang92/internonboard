import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { BusinessClockService } from '../../../common/time/business-clock.service';
import type { AttendanceReconciliationService } from '../attendance-reconciliation.service';
import { AttendanceAbsenceScheduler } from './attendance-absence.scheduler';

const REFERENCE_NOW = new Date('2026-08-06T03:01:00.000Z');

function createScheduler(configuredValue?: string) {
  const config = {
    get: jest.fn().mockReturnValue(configuredValue),
  };
  const reconciliationService = {
    reconcileDate: jest.fn().mockResolvedValue({
      startDate: '2026-08-06',
      endDate: '2026-08-06',
      studentId: null,
      startedAt: REFERENCE_NOW,
      completedAt: REFERENCE_NOW,
      scannedCount: 8,
      createdCount: 3,
      skippedCount: 5,
      failedCount: 0,
      failures: [],
    }),
  };
  const businessClock = {
    now: jest.fn().mockReturnValue(REFERENCE_NOW),
    getBusinessDate: jest.fn().mockReturnValue('2026-08-06'),
  };

  return {
    config,
    reconciliationService,
    businessClock,
    scheduler: new AttendanceAbsenceScheduler(
      config as unknown as ConfigService,
      reconciliationService as unknown as AttendanceReconciliationService,
      businessClock as unknown as BusinessClockService,
    ),
  };
}

describe('AttendanceAbsenceScheduler', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([undefined, '', 'false', '0', 'no'])(
    'does not reconcile when ATTENDANCE_CRON_ENABLED is %s',
    async (configuredValue) => {
      const { scheduler, reconciliationService, businessClock } =
        createScheduler(configuredValue);

      await scheduler.reconcileDailyAbsences();

      expect(businessClock.now).not.toHaveBeenCalled();
      expect(reconciliationService.reconcileDate).not.toHaveBeenCalled();
    },
  );

  it.each(['true', 'TRUE', '1', 'yes', 'on'])(
    'reconciles the Beijing business date when enabled with %s',
    async (configuredValue) => {
      const { scheduler, reconciliationService, businessClock } =
        createScheduler(configuredValue);

      await scheduler.reconcileDailyAbsences();

      expect(businessClock.getBusinessDate).toHaveBeenCalledWith(REFERENCE_NOW);
      expect(reconciliationService.reconcileDate).toHaveBeenCalledWith(
        '2026-08-06',
        REFERENCE_NOW,
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('startedAt=2026-08-06T03:01:00.000Z'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'completedAt=2026-08-06T03:01:00.000Z, scanned=8, created=3, skipped=5, failed=0',
        ),
      );
    },
  );

  it('warns when a run completes with isolated student failures', async () => {
    const { scheduler, reconciliationService } = createScheduler('true');
    reconciliationService.reconcileDate.mockResolvedValueOnce({
      startDate: '2026-08-06',
      endDate: '2026-08-06',
      studentId: null,
      startedAt: REFERENCE_NOW,
      completedAt: REFERENCE_NOW,
      scannedCount: 3,
      createdCount: 2,
      skippedCount: 0,
      failedCount: 1,
      failures: [
        {
          studentId: '6a574ec45bd0f7b2a8b65a02',
          attendanceDate: '2026-08-06',
          message: '地点查询失败',
        },
      ],
    });

    await scheduler.reconcileDailyAbsences();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('scanned=3, created=2, skipped=0, failed=1'),
    );
  });

  it('surfaces reconciliation failures so the scheduler records a failed run', async () => {
    const { scheduler, reconciliationService } = createScheduler('true');
    reconciliationService.reconcileDate.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    await expect(scheduler.reconcileDailyAbsences()).rejects.toThrow(
      'database unavailable',
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('database unavailable'),
    );
  });
});
