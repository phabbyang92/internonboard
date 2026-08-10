import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BusinessClockService } from '../../common/time/business-clock.service';
import { OnboardingStatus } from '../student/enums/student.enums';
import { AttendanceLeavePolicyService } from './attendance-leave-policy.service';
import { AttendanceEligibilityReason } from './enums/attendance-eligibility-reason.enum';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import type { AttendanceEligibilityResult } from './interfaces/attendance-eligibility-result.interface';

describe('AttendanceLeavePolicyService', () => {
  const now = new Date('2026-08-05T16:30:00.000Z');
  const businessClock = {
    now: jest.fn(() => new Date(now)),
    getBusinessDate: jest.fn(() => '2026-08-06'),
  } as unknown as BusinessClockService;
  const service = new AttendanceLeavePolicyService(businessClock);

  const eligibility = (
    reason: AttendanceEligibilityReason,
  ): AttendanceEligibilityResult => ({
    eligible: reason === AttendanceEligibilityReason.Eligible,
    reason,
    attendanceDate: '2026-08-06',
    student: {
      id: '6a574ec45bd0f7b2a8b65a02',
      ownerHrId: '6a574ec45bd0f7b2a8b65a03',
      onboardingStatus: OnboardingStatus.Onboarded,
      onboardingStartAt: new Date('2026-08-01T00:00:00.000Z'),
      onboardingEndAt: new Date('2026-09-30T00:00:00.000Z'),
    },
    location: null,
    workday: null,
  });

  it('accepts today and the fourteenth future calendar day', () => {
    expect(
      service.validateRequestedDates(['2026-08-20', '2026-08-06'], now),
    ).toEqual(['2026-08-06', '2026-08-20']);
  });

  it.each([
    ['2026-08-05', AttendanceErrorCode.LeaveDateOutOfRange],
    ['2026-08-21', AttendanceErrorCode.LeaveDateOutOfRange],
    ['2026-02-30', AttendanceErrorCode.InvalidLeaveDate],
    ['2026/08/06', AttendanceErrorCode.InvalidLeaveDate],
  ])('rejects invalid or out-of-window date %s', (date, code) => {
    try {
      service.validateRequestedDates([date], now);
      throw new Error('Expected leave date validation to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(BadRequestException);

      if (!(error instanceof BadRequestException)) {
        throw error;
      }

      expect(error.getResponse()).toEqual(expect.objectContaining({ code }));
    }
  });

  it('defensively rejects duplicate dates when called without DTO validation', () => {
    try {
      service.validateRequestedDates(['2026-08-06', '2026-08-06'], now);
      throw new Error('Expected duplicate leave dates to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(BadRequestException);

      if (!(error instanceof BadRequestException)) {
        throw error;
      }

      expect(error.getResponse()).toEqual(
        expect.objectContaining({
          code: AttendanceErrorCode.InvalidLeaveDate,
        }),
      );
    }
  });

  it('allows leave registration on an eligible internship workday', () => {
    expect(() =>
      service.assertCanRegisterLeave(
        eligibility(AttendanceEligibilityReason.Eligible),
      ),
    ).not.toThrow();
  });

  it.each([
    AttendanceEligibilityReason.StudentNotOnboarded,
    AttendanceEligibilityReason.BeforeInternship,
    AttendanceEligibilityReason.AfterInternship,
  ])('rejects inactive internship status %s', (reason) => {
    try {
      service.assertCanRegisterLeave(eligibility(reason));
      throw new Error('Expected inactive internship status to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ForbiddenException);

      if (!(error instanceof ForbiddenException)) {
        throw error;
      }

      expect(error.getResponse()).toEqual(
        expect.objectContaining({
          code: AttendanceErrorCode.StudentNotOnboarded,
        }),
      );
    }
  });

  it('rejects a weekend or configured holiday', () => {
    try {
      service.assertCanRegisterLeave(
        eligibility(AttendanceEligibilityReason.NonWorkday),
      );
      throw new Error('Expected a non-workday to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(BadRequestException);

      if (!(error instanceof BadRequestException)) {
        throw error;
      }

      expect(error.getResponse()).toEqual(
        expect.objectContaining({
          code: AttendanceErrorCode.AttendanceNotRequired,
        }),
      );
    }
  });
});
