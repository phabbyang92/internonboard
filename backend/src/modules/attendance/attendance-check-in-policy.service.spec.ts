import { BadRequestException } from '@nestjs/common';
import { WorkLocation } from '../student/enums/student.enums';
import { AttendanceCheckInPolicyService } from './attendance-check-in-policy.service';
import { OFFICE_WORK_LOCATIONS } from './attendance.constants';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import { CheckInMode } from './enums/check-in-mode.enum';

describe('AttendanceCheckInPolicyService', () => {
  const service = new AttendanceCheckInPolicyService();

  it('allows only online check-in for an online assignment', () => {
    expect(service.getPolicy(WorkLocation.Online)).toEqual({
      assignedWorkLocation: WorkLocation.Online,
      allowedCheckInModes: [CheckInMode.Online],
      officeNetworkRequiredFor: [],
    });
  });

  it.each(OFFICE_WORK_LOCATIONS)(
    'allows online and offline check-in for %s',
    (workLocation) => {
      expect(service.getPolicy(workLocation)).toEqual({
        assignedWorkLocation: workLocation,
        allowedCheckInModes: [CheckInMode.Online, CheckInMode.Offline],
        officeNetworkRequiredFor: [CheckInMode.Offline],
      });
    },
  );

  it('rejects a forged offline mode for an online assignment', () => {
    expect(() =>
      service.assertCheckInModeAllowed(
        WorkLocation.Online,
        CheckInMode.Offline,
      ),
    ).toThrow(BadRequestException);

    try {
      service.assertCheckInModeAllowed(
        WorkLocation.Online,
        CheckInMode.Offline,
      );
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toEqual({
        code: AttendanceErrorCode.CheckInModeNotAllowed,
        message: '当前工作地点不允许所选签到方式',
      });
    }
  });

  it('does not require an office network for online mode at an office', () => {
    expect(
      service.requiresOfficeNetwork(
        WorkLocation.BeijingOffice,
        CheckInMode.Online,
      ),
    ).toBe(false);
  });

  it('requires an office network for offline mode at an office', () => {
    expect(
      service.requiresOfficeNetwork(
        WorkLocation.BeijingOffice,
        CheckInMode.Offline,
      ),
    ).toBe(true);
  });

  it('rejects an unknown work-location value from persisted data', () => {
    expect(() => service.getPolicy('不存在的地点')).toThrow(
      BadRequestException,
    );
  });
});
