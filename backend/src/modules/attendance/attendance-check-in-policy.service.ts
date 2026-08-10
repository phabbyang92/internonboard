import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkLocation } from '../student/enums/student.enums';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import { CheckInMode } from './enums/check-in-mode.enum';
import type { AttendanceCheckInPolicy } from './interfaces/attendance-check-in-policy.interface';

const SUPPORTED_WORK_LOCATIONS: readonly string[] = Object.values(WorkLocation);

@Injectable()
export class AttendanceCheckInPolicyService {
  getPolicy(workLocation: string): AttendanceCheckInPolicy {
    const normalizedLocation = this.parseWorkLocation(workLocation);

    if (normalizedLocation === WorkLocation.Online) {
      return {
        assignedWorkLocation: normalizedLocation,
        allowedCheckInModes: [CheckInMode.Online],
        officeNetworkRequiredFor: [],
      };
    }

    return {
      assignedWorkLocation: normalizedLocation,
      allowedCheckInModes: [CheckInMode.Online, CheckInMode.Offline],
      officeNetworkRequiredFor: [CheckInMode.Offline],
    };
  }

  assertCheckInModeAllowed(
    workLocation: string,
    checkInMode: CheckInMode,
  ): AttendanceCheckInPolicy {
    const policy = this.getPolicy(workLocation);

    if (!policy.allowedCheckInModes.includes(checkInMode)) {
      throw new BadRequestException({
        code: AttendanceErrorCode.CheckInModeNotAllowed,
        message: '当前工作地点不允许所选签到方式',
      });
    }

    return policy;
  }

  requiresOfficeNetwork(
    workLocation: string,
    checkInMode: CheckInMode,
  ): boolean {
    const policy = this.assertCheckInModeAllowed(workLocation, checkInMode);

    return policy.officeNetworkRequiredFor.includes(checkInMode);
  }

  private parseWorkLocation(workLocation: string): WorkLocation {
    if (!SUPPORTED_WORK_LOCATIONS.includes(workLocation)) {
      throw new BadRequestException('当前工作地点不支持出勤登记');
    }

    return workLocation as WorkLocation;
  }
}
