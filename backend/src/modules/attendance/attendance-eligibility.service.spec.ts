import { BadRequestException } from '@nestjs/common';
import type { BusinessClockService } from '../../common/time/business-clock.service';
import { OnboardingStatus, WorkLocation } from '../student/enums/student.enums';
import type { StudentService } from '../student/student.service';
import type { AttendanceCalendarService } from './attendance-calendar.service';
import { AttendanceEligibilityService } from './attendance-eligibility.service';
import type { AttendanceLocationService } from './attendance-location.service';
import { AttendanceEligibilityReason } from './enums/attendance-eligibility-reason.enum';
import { RegionCode } from './enums/region-code.enum';
import type { AttendanceLocationResult } from './interfaces/attendance-location-result.interface';
import type { WorkdayResult } from './interfaces/workday-result.interface';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const OWNER_HR_ID = '6a574ec45bd0f7b2a8b65b99';
const NOW = new Date('2026-08-05T02:00:00.000Z');

function defaultStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: STUDENT_ID,
    ownerHrId: OWNER_HR_ID,
    onboardingStatus: OnboardingStatus.Onboarded,
    onboardingStartAt: new Date('2026-08-01T00:00:00.000Z'),
    onboardingEndAt: new Date('2026-08-05T00:00:00.000Z'),
    ...overrides,
  };
}

function defaultLocation(): AttendanceLocationResult {
  return {
    assignmentId: '6a574ec45bd0f7b2a8b65c20',
    studentId: STUDENT_ID,
    workLocation: WorkLocation.ShanghaiOffice,
    regionCode: RegionCode.Shanghai,
    effectiveFrom: new Date('2026-07-31T16:00:00.000Z'),
    effectiveTo: null,
  };
}

function defaultWorkday(overrides: Partial<WorkdayResult> = {}): WorkdayResult {
  return {
    attendanceDate: '2026-08-05',
    regionCode: RegionCode.Shanghai,
    isWorkday: true,
    reason: 'weekday',
    holiday: null,
    ...overrides,
  };
}

function createDependencies(
  options: {
    student?: Record<string, unknown>;
    location?: AttendanceLocationResult | null;
    workday?: WorkdayResult;
  } = {},
) {
  const studentService = {
    updateDueOnboardingStatuses: jest.fn().mockResolvedValue({}),
    findOneById: jest
      .fn()
      .mockResolvedValue(options.student ?? defaultStudent()),
  };
  const clock = {
    now: jest.fn().mockReturnValue(NOW),
    getBusinessDate: jest.fn((date?: Date) =>
      date ? date.toISOString().slice(0, 10) : '2026-08-05',
    ),
  };
  const locationService = {
    findEffectiveLocation: jest
      .fn()
      .mockResolvedValue(
        options.location === undefined ? defaultLocation() : options.location,
      ),
  };
  const calendarService = {
    isWorkday: jest.fn().mockResolvedValue(options.workday ?? defaultWorkday()),
  };

  return {
    studentService,
    clock,
    locationService,
    calendarService,
    service: new AttendanceEligibilityService(
      studentService as unknown as StudentService,
      clock as unknown as BusinessClockService,
      locationService as unknown as AttendanceLocationService,
      calendarService as unknown as AttendanceCalendarService,
    ),
  };
}

describe('AttendanceEligibilityService', () => {
  it('returns all snapshots when the student is eligible', async () => {
    const { service, studentService, locationService, calendarService } =
      createDependencies();

    const result = await service.evaluate(STUDENT_ID, '2026-08-05', NOW);

    expect(studentService.updateDueOnboardingStatuses).toHaveBeenCalledWith(
      NOW,
    );
    expect(locationService.findEffectiveLocation).toHaveBeenCalledWith(
      STUDENT_ID,
      '2026-08-05',
    );
    expect(calendarService.isWorkday).toHaveBeenCalledWith(
      '2026-08-05',
      RegionCode.Shanghai,
    );
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(AttendanceEligibilityReason.Eligible);
    expect(result.student.ownerHrId).toBe(OWNER_HR_ID);
    expect(result.location?.workLocation).toBe(WorkLocation.ShanghaiOffice);
    expect(result.workday?.isWorkday).toBe(true);
  });

  it('uses one BusinessClock timestamp and date for today evaluation', async () => {
    const { service, clock, studentService } = createDependencies();

    const result = await service.evaluateToday(STUDENT_ID);

    expect(clock.now).toHaveBeenCalledTimes(1);
    expect(clock.getBusinessDate).toHaveBeenCalledWith(NOW);
    expect(studentService.updateDueOnboardingStatuses).toHaveBeenCalledWith(
      NOW,
    );
    expect(result.attendanceDate).toBe('2026-08-05');
  });

  it('reuses one refreshed student snapshot when evaluating many dates', async () => {
    const { service, studentService, locationService } = createDependencies();

    const results = await service.evaluateMany(
      STUDENT_ID,
      ['2026-08-04', '2026-08-05'],
      NOW,
    );

    expect(studentService.updateDueOnboardingStatuses).toHaveBeenCalledTimes(1);
    expect(studentService.findOneById).toHaveBeenCalledTimes(1);
    expect(locationService.findEffectiveLocation).toHaveBeenCalledTimes(2);
    expect(results.map((result) => result.attendanceDate)).toEqual([
      '2026-08-04',
      '2026-08-05',
    ]);
  });

  it('allows attendance on the internship end date', async () => {
    const { service } = createDependencies({
      student: defaultStudent({
        onboardingEndAt: new Date('2026-08-05T00:00:00.000Z'),
      }),
    });

    await expect(
      service.evaluate(STUDENT_ID, '2026-08-05', NOW),
    ).resolves.toEqual(expect.objectContaining({ eligible: true }));
  });

  it('rejects attendance after the internship end date', async () => {
    const { service, locationService } = createDependencies({
      student: defaultStudent({
        onboardingEndAt: new Date('2026-08-04T00:00:00.000Z'),
      }),
    });

    const result = await service.evaluate(STUDENT_ID, '2026-08-05', NOW);

    expect(result.reason).toBe(AttendanceEligibilityReason.AfterInternship);
    expect(locationService.findEffectiveLocation).not.toHaveBeenCalled();
  });

  it('rejects attendance before the internship starts', async () => {
    const { service } = createDependencies({
      student: defaultStudent({
        onboardingStartAt: new Date('2026-08-06T00:00:00.000Z'),
        onboardingEndAt: null,
      }),
    });

    const result = await service.evaluate(STUDENT_ID, '2026-08-05', NOW);

    expect(result.reason).toBe(AttendanceEligibilityReason.BeforeInternship);
  });

  it('rejects a student without an onboarding arrangement', async () => {
    const { service } = createDependencies({
      student: defaultStudent({ onboardingStartAt: null }),
    });

    const result = await service.evaluate(STUDENT_ID, '2026-08-05', NOW);

    expect(result.reason).toBe(AttendanceEligibilityReason.ArrangementMissing);
  });

  it('requires the refreshed student status to be onboarded', async () => {
    const { service, locationService } = createDependencies({
      student: defaultStudent({
        onboardingStatus: OnboardingStatus.PendingOnboarding,
      }),
    });

    const result = await service.evaluate(STUDENT_ID, '2026-08-05', NOW);

    expect(result.reason).toBe(AttendanceEligibilityReason.StudentNotOnboarded);
    expect(locationService.findEffectiveLocation).not.toHaveBeenCalled();
  });

  it('rejects a student without an effective work location', async () => {
    const { service, calendarService } = createDependencies({ location: null });

    const result = await service.evaluate(STUDENT_ID, '2026-08-05', NOW);

    expect(result.reason).toBe(AttendanceEligibilityReason.WorkLocationMissing);
    expect(calendarService.isWorkday).not.toHaveBeenCalled();
  });

  it('returns the non-workday details for weekends or configured holidays', async () => {
    const workday = defaultWorkday({
      isWorkday: false,
      reason: 'weekend',
    });
    const { service } = createDependencies({ workday });

    const result = await service.evaluate(STUDENT_ID, '2026-08-05', NOW);

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(AttendanceEligibilityReason.NonWorkday);
    expect(result.location).not.toBeNull();
    expect(result.workday).toBe(workday);
  });

  it('validates the attendance date before updating student statuses', async () => {
    const { service, studentService } = createDependencies();

    await expect(
      service.evaluate(STUDENT_ID, '2026-02-30', NOW),
    ).rejects.toThrow(BadRequestException);
    expect(studentService.updateDueOnboardingStatuses).not.toHaveBeenCalled();
  });
});
