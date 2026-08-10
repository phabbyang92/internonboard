import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { BusinessClockService } from '../../common/time/business-clock.service';
import { OnboardingStatus, WorkLocation } from '../student/enums/student.enums';
import { AttendanceCheckInPolicyService } from './attendance-check-in-policy.service';
import { AttendanceCheckInService } from './attendance-check-in.service';
import type { AttendanceDeviceService } from './attendance-device.service';
import type { AttendanceEligibilityService } from './attendance-eligibility.service';
import { AttendanceEligibilityReason } from './enums/attendance-eligibility-reason.enum';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import { AttendanceSource } from './enums/attendance-source.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { CheckInMode } from './enums/check-in-mode.enum';
import { LateLevel } from './enums/late-level.enum';
import { RegionCode } from './enums/region-code.enum';
import type { AttendanceEligibilityResult } from './interfaces/attendance-eligibility-result.interface';
import type { OfficeNetworkService } from './office-network.service';
import type { AttendanceRecordDocument } from './schemas/attendance-record.schema';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const OWNER_HR_ID = '6a574ec45bd0f7b2a8b65b99';
const ASSIGNMENT_ID = '6a574ec45bd0f7b2a8b65c20';
const NETWORK_ID = '6a574ec45bd0f7b2a8b65d01';
const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const DEVICE_HASH = 'a'.repeat(64);
const ATTENDANCE_DATE = '2026-08-06';
const NOW = new Date('2026-08-06T01:30:00.000Z');

function eligibleResult(
  overrides: Partial<AttendanceEligibilityResult> = {},
): AttendanceEligibilityResult {
  return {
    eligible: true,
    reason: AttendanceEligibilityReason.Eligible,
    attendanceDate: ATTENDANCE_DATE,
    student: {
      id: STUDENT_ID,
      ownerHrId: OWNER_HR_ID,
      onboardingStatus: OnboardingStatus.Onboarded,
      onboardingStartAt: new Date('2026-08-01T16:00:00.000Z'),
      onboardingEndAt: new Date('2026-08-31T16:00:00.000Z'),
    },
    location: {
      assignmentId: ASSIGNMENT_ID,
      studentId: STUDENT_ID,
      workLocation: WorkLocation.ShanghaiOffice,
      regionCode: RegionCode.Shanghai,
      effectiveFrom: new Date('2026-08-01T16:00:00.000Z'),
      effectiveTo: null,
    },
    workday: {
      attendanceDate: ATTENDANCE_DATE,
      regionCode: RegionCode.Shanghai,
      isWorkday: true,
      reason: 'weekday',
      holiday: null,
    },
    ...overrides,
  };
}

function createService(options?: {
  existingRecord?: Record<string, unknown> | null;
  eligibility?: AttendanceEligibilityResult;
  attendanceWindow?: 'on_time' | 'late' | 'severe' | 'closed';
  createError?: unknown;
}) {
  const existingRecord = options?.existingRecord ?? null;
  const exec = jest.fn().mockResolvedValue(existingRecord);
  const lean = jest.fn().mockReturnValue({ exec });
  const create = options?.createError
    ? jest.fn().mockRejectedValue(options.createError)
    : jest.fn().mockResolvedValue({ _id: new Types.ObjectId() });
  const model = {
    findOne: jest.fn().mockReturnValue({ lean }),
    create,
  };
  const clock = {
    now: jest.fn().mockReturnValue(NOW),
    getBusinessDate: jest.fn().mockReturnValue(ATTENDANCE_DATE),
    getAttendanceWindow: jest
      .fn()
      .mockReturnValue(options?.attendanceWindow ?? 'on_time'),
  };
  const eligibilityService = {
    evaluate: jest
      .fn()
      .mockResolvedValue(options?.eligibility ?? eligibleResult()),
  };
  const policyService = new AttendanceCheckInPolicyService();
  const deviceService = {
    hashDeviceId: jest.fn().mockReturnValue(DEVICE_HASH),
    assertDeviceAvailable: jest.fn().mockResolvedValue(undefined),
    throwIfDeviceAlreadyUsed: jest.fn((error: unknown) => {
      const mongoError = error as {
        code?: number;
        keyPattern?: Record<string, number>;
      };

      if (
        mongoError?.code === 11000 &&
        mongoError.keyPattern?.deviceIdHash === 1
      ) {
        throw new ConflictException({
          code: AttendanceErrorCode.DeviceAlreadyUsed,
          message: '该设备今天已经用于其他出勤登记',
        });
      }
    }),
  };
  const officeNetworkService = {
    assertIpAllowed: jest.fn().mockResolvedValue({
      matchedOfficeNetworkId: NETWORK_ID,
      workLocation: WorkLocation.ShanghaiOffice,
      ipMatchSucceeded: true,
    }),
  };

  return {
    model,
    clock,
    eligibilityService,
    deviceService,
    officeNetworkService,
    service: new AttendanceCheckInService(
      model as unknown as Model<AttendanceRecordDocument>,
      clock as unknown as BusinessClockService,
      eligibilityService as unknown as AttendanceEligibilityService,
      policyService,
      deviceService as unknown as AttendanceDeviceService,
      officeNetworkService as unknown as OfficeNetworkService,
    ),
  };
}

describe('AttendanceCheckInService', () => {
  it('creates an on-time online check-in from backend-owned data', async () => {
    const { service, model, officeNetworkService } = createService();

    await expect(
      service.checkIn(STUDENT_ID, {
        checkInMode: CheckInMode.Online,
        deviceId: DEVICE_ID,
      }),
    ).resolves.toEqual({
      attendanceDate: ATTENDANCE_DATE,
      status: AttendanceStatus.OnTime,
      lateLevel: null,
      message: '打卡成功',
      checkInAt: NOW,
      assignedWorkLocation: WorkLocation.ShanghaiOffice,
      checkInMode: CheckInMode.Online,
      checkInLocation: WorkLocation.Online,
    });
    expect(officeNetworkService.assertIpAllowed).not.toHaveBeenCalled();
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: new Types.ObjectId(STUDENT_ID),
        ownerHrId: new Types.ObjectId(OWNER_HR_ID),
        attendanceDate: ATTENDANCE_DATE,
        source: AttendanceSource.CheckIn,
        checkInAt: NOW,
        assignedWorkLocation: WorkLocation.ShanghaiOffice,
        checkInMode: CheckInMode.Online,
        checkInLocation: WorkLocation.Online,
        deviceIdHash: DEVICE_HASH,
        matchedOfficeNetworkId: null,
        ipMatchSucceeded: null,
      }),
    );
  });

  it('requires and stores an office-network match for offline check-in', async () => {
    const { service, model, officeNetworkService } = createService();

    await service.checkIn(
      STUDENT_ID,
      { checkInMode: CheckInMode.Offline, deviceId: DEVICE_ID },
      '140.207.40.253',
    );

    expect(officeNetworkService.assertIpAllowed).toHaveBeenCalledWith(
      WorkLocation.ShanghaiOffice,
      '140.207.40.253',
    );
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        checkInLocation: WorkLocation.ShanghaiOffice,
        matchedOfficeNetworkId: new Types.ObjectId(NETWORK_ID),
        ipMatchSucceeded: true,
      }),
    );
  });

  it.each([
    ['late', AttendanceStatus.Late, LateLevel.Normal, '打卡成功，今日记为迟到'],
    [
      'severe',
      AttendanceStatus.Absent,
      LateLevel.Severe,
      '严重迟到，今日记缺勤',
    ],
  ] as const)(
    'maps the %s window to the expected final status',
    async (attendanceWindow, status, lateLevel, message) => {
      const { service, model } = createService({ attendanceWindow });

      const result = await service.checkIn(STUDENT_ID, {
        checkInMode: CheckInMode.Online,
        deviceId: DEVICE_ID,
      });

      expect(result).toMatchObject({ status, lateLevel, message });
      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ status, lateLevel, checkInAt: NOW }),
      );
    },
  );

  it('creates a non-device absence and rejects check-in after closing time', async () => {
    const { service, model, deviceService } = createService({
      attendanceWindow: 'closed',
    });

    await expect(
      service.checkIn(STUDENT_ID, {
        checkInMode: CheckInMode.Online,
        deviceId: DEVICE_ID,
      }),
    ).rejects.toMatchObject({
      response: {
        code: AttendanceErrorCode.CheckInWindowClosed,
        message: '已过打卡时间，无法打卡，今日记缺勤',
      },
    });
    expect(deviceService.assertDeviceAvailable).not.toHaveBeenCalled();
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: AttendanceStatus.Absent,
        source: AttendanceSource.AbsenceScheduler,
        checkInAt: null,
        checkInAttemptAt: NOW,
        deviceIdHash: null,
      }),
    );
  });

  it('rejects a student who already has a check-in record', async () => {
    const { service } = createService({
      existingRecord: {
        source: AttendanceSource.CheckIn,
        status: AttendanceStatus.OnTime,
      },
    });

    await expect(
      service.checkIn(STUDENT_ID, {
        checkInMode: CheckInMode.Online,
        deviceId: DEVICE_ID,
      }),
    ).rejects.toMatchObject({
      response: { code: AttendanceErrorCode.StudentAlreadyCheckedIn },
    });
  });

  it('returns a dedicated conflict when leave already exists', async () => {
    const { service } = createService({
      existingRecord: {
        source: AttendanceSource.LeaveRegistration,
        status: AttendanceStatus.Leave,
      },
    });

    await expect(
      service.checkIn(STUDENT_ID, {
        checkInMode: CheckInMode.Online,
        deviceId: DEVICE_ID,
      }),
    ).rejects.toMatchObject({
      response: { code: AttendanceErrorCode.LeaveAlreadyRegistered },
    });
  });

  it('rejects a non-workday before checking device availability', async () => {
    const { service, deviceService } = createService({
      eligibility: eligibleResult({
        eligible: false,
        reason: AttendanceEligibilityReason.NonWorkday,
      }),
    });

    await expect(
      service.checkIn(STUDENT_ID, {
        checkInMode: CheckInMode.Online,
        deviceId: DEVICE_ID,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(deviceService.assertDeviceAvailable).not.toHaveBeenCalled();
  });

  it('rejects a student outside the active internship period', async () => {
    const { service } = createService({
      eligibility: eligibleResult({
        eligible: false,
        reason: AttendanceEligibilityReason.AfterInternship,
      }),
    });

    await expect(
      service.checkIn(STUDENT_ID, {
        checkInMode: CheckInMode.Online,
        deviceId: DEVICE_ID,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('converts a student unique-index race into a business conflict', async () => {
    const { service } = createService({
      createError: {
        code: 11000,
        keyPattern: { studentId: 1, attendanceDate: 1 },
      },
    });

    await expect(
      service.checkIn(STUDENT_ID, {
        checkInMode: CheckInMode.Online,
        deviceId: DEVICE_ID,
      }),
    ).rejects.toMatchObject({
      response: { code: AttendanceErrorCode.StudentAlreadyCheckedIn },
    });
  });

  it('converts a device unique-index race into a business conflict', async () => {
    const { service } = createService({
      createError: {
        code: 11000,
        keyPattern: { deviceIdHash: 1, attendanceDate: 1 },
      },
    });

    await expect(
      service.checkIn(STUDENT_ID, {
        checkInMode: CheckInMode.Online,
        deviceId: DEVICE_ID,
      }),
    ).rejects.toMatchObject({
      response: { code: AttendanceErrorCode.DeviceAlreadyUsed },
    });
  });

  it('rejects a forged offline mode for a student assigned online', async () => {
    const { service, model } = createService({
      eligibility: eligibleResult({
        location: {
          assignmentId: ASSIGNMENT_ID,
          studentId: STUDENT_ID,
          workLocation: WorkLocation.Online,
          regionCode: RegionCode.Online,
          effectiveFrom: new Date('2026-08-01T16:00:00.000Z'),
          effectiveTo: null,
        },
      }),
    });

    await expect(
      service.checkIn(STUDENT_ID, {
        checkInMode: CheckInMode.Offline,
        deviceId: DEVICE_ID,
      }),
    ).rejects.toMatchObject({
      response: { code: AttendanceErrorCode.CheckInModeNotAllowed },
    });
    expect(model.create).not.toHaveBeenCalled();
  });
});
