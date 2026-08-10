import { BadRequestException } from '@nestjs/common';
import type { BusinessClockService } from '../../common/time/business-clock.service';
import { HrRole } from '../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { AttendanceQueryPreparationService } from './attendance-query-preparation.service';
import type { AttendanceReconciliationResult } from './interfaces/attendance-reconciliation-result.interface';
import type { AttendanceReconciliationService } from './attendance-reconciliation.service';

const NOW = new Date('2026-08-06T04:00:00.000Z');
const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const RESULT: AttendanceReconciliationResult = {
  startDate: '2026-08-06',
  endDate: '2026-08-06',
  studentId: null,
  startedAt: NOW,
  completedAt: NOW,
  scannedCount: 1,
  createdCount: 1,
  skippedCount: 0,
  failedCount: 0,
  failures: [],
};
const ADMIN_ACCESS: HrAccessContext = {
  hrUserId: HR_ID,
  role: HrRole.Admin,
};
const HR_ACCESS: HrAccessContext = {
  hrUserId: HR_ID,
  role: HrRole.Hr,
};

function createService() {
  const reconciliationService = {
    reconcileDate: jest.fn().mockResolvedValue(RESULT),
    reconcileRange: jest.fn().mockResolvedValue(RESULT),
    reconcileOwner: jest.fn().mockResolvedValue(RESULT),
    reconcileStudent: jest.fn().mockResolvedValue(RESULT),
  };
  const businessClock = {
    now: jest.fn().mockReturnValue(NOW),
    getBusinessDate: jest.fn().mockReturnValue('2026-08-06'),
  };

  return {
    reconciliationService,
    businessClock,
    service: new AttendanceQueryPreparationService(
      reconciliationService as unknown as AttendanceReconciliationService,
      businessClock as unknown as BusinessClockService,
    ),
  };
}

describe('AttendanceQueryPreparationService', () => {
  it('prepares an Admin daily query with global reconciliation', async () => {
    const { service, reconciliationService } = createService();

    await service.prepareHrDaily('2026-08-06', ADMIN_ACCESS, NOW);

    expect(reconciliationService.reconcileDate).toHaveBeenCalledWith(
      '2026-08-06',
      NOW,
    );
    expect(reconciliationService.reconcileOwner).not.toHaveBeenCalled();
  });

  it('prepares a normal HR daily query only for owned students', async () => {
    const { service, reconciliationService } = createService();

    await service.prepareHrDaily('2026-08-06', HR_ACCESS, NOW);

    expect(reconciliationService.reconcileOwner).toHaveBeenCalledWith(
      HR_ID,
      '2026-08-06',
      '2026-08-06',
      NOW,
    );
    expect(reconciliationService.reconcileDate).not.toHaveBeenCalled();
  });

  it('prepares an Admin filtered daily query only for the requested owner', async () => {
    const { service, reconciliationService } = createService();

    await service.prepareHrDaily('2026-08-06', ADMIN_ACCESS, NOW, HR_ID);

    expect(reconciliationService.reconcileOwner).toHaveBeenCalledWith(
      HR_ID,
      '2026-08-06',
      '2026-08-06',
      NOW,
    );
    expect(reconciliationService.reconcileDate).not.toHaveBeenCalled();
  });

  it('clamps an Admin current-month query to the Beijing business date', async () => {
    const { service, reconciliationService } = createService();

    await service.prepareHrMonth('2026-08', ADMIN_ACCESS, NOW);

    expect(reconciliationService.reconcileRange).toHaveBeenCalledWith(
      '2026-08-01',
      '2026-08-06',
      NOW,
    );
  });

  it('uses the complete past month for a normal HR query', async () => {
    const { service, reconciliationService } = createService();

    await service.prepareHrMonth('2024-02', HR_ACCESS, NOW);

    expect(reconciliationService.reconcileOwner).toHaveBeenCalledWith(
      HR_ID,
      '2024-02-01',
      '2024-02-29',
      NOW,
    );
  });

  it('limits an Admin month preparation to the selected owner', async () => {
    const { service, reconciliationService } = createService();

    await service.prepareHrMonth('2026-08', ADMIN_ACCESS, NOW, HR_ID);

    expect(reconciliationService.reconcileOwner).toHaveBeenCalledWith(
      HR_ID,
      '2026-08-01',
      '2026-08-06',
      NOW,
    );
    expect(reconciliationService.reconcileRange).not.toHaveBeenCalled();
  });

  it('prepares student detail reconciliation for only that student', async () => {
    const { service, reconciliationService } = createService();

    await service.prepareStudentMonth(STUDENT_ID, '2026-07', NOW);

    expect(reconciliationService.reconcileStudent).toHaveBeenCalledWith(
      STUDENT_ID,
      '2026-07-01',
      '2026-07-31',
      NOW,
    );
  });

  it('prepares a student daily query for only that student and date', async () => {
    const { service, reconciliationService } = createService();

    await service.prepareStudentDaily(STUDENT_ID, '2026-08-06', NOW);

    expect(reconciliationService.reconcileStudent).toHaveBeenCalledWith(
      STUDENT_ID,
      '2026-08-06',
      '2026-08-06',
      NOW,
    );
  });

  it('does not scan a future month before returning query data', async () => {
    const { service, reconciliationService } = createService();

    await expect(
      service.prepareHrMonth('2026-09', ADMIN_ACCESS, NOW),
    ).resolves.toBeNull();
    await expect(
      service.prepareStudentMonth(STUDENT_ID, '2026-09', NOW),
    ).resolves.toBeNull();
    expect(reconciliationService.reconcileRange).not.toHaveBeenCalled();
    expect(reconciliationService.reconcileStudent).not.toHaveBeenCalled();
  });

  it.each(['2026', '2026-00', '2026-13', '26-08'])(
    'rejects invalid query month %s',
    (month) => {
      const { service } = createService();

      expect(() => service.prepareHrMonth(month, ADMIN_ACCESS, NOW)).toThrow(
        BadRequestException,
      );
    },
  );
});
