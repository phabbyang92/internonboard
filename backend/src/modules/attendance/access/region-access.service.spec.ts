import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Model } from 'mongoose';
import { HrRole } from '../../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../../auth/interfaces/hr-access-context.interface';
import type { HrUserDocument } from '../../auth/schemas/hr-user.schema';
import { WorkLocation } from '../../student/enums/student.enums';
import { AttendanceCalendarScope } from '../enums/attendance-calendar-scope.enum';
import { RegionCode } from '../enums/region-code.enum';
import { RegionAccessService } from './region-access.service';

const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const ACCESS: HrAccessContext = { hrUserId: HR_ID, role: HrRole.Hr };

function createService(
  currentHr: {
    role: HrRole;
    managedRegionCodes?: RegionCode[];
  } | null,
) {
  const exec = jest.fn().mockResolvedValue(currentHr);
  const lean = jest.fn().mockReturnValue({ exec });
  const select = jest.fn().mockReturnValue({ lean });
  const model = {
    findById: jest.fn().mockReturnValue({ select }),
  };

  return {
    model,
    service: new RegionAccessService(model as unknown as Model<HrUserDocument>),
  };
}

describe('RegionAccessService', () => {
  it('maps current and legacy work-location names to stable regions', () => {
    const { service } = createService(null);

    expect(service.getRegionForWorkLocation(WorkLocation.ShanghaiOffice)).toBe(
      RegionCode.Shanghai,
    );
    expect(service.getRegionForWorkLocation('上海静安')).toBe(
      RegionCode.Shanghai,
    );
    expect(service.getRegionForWorkLocation(WorkLocation.Online)).toBe(
      RegionCode.Online,
    );
  });

  it('fails clearly when a new work location has no region mapping', () => {
    const { service } = createService(null);

    expect(() => service.getRegionForWorkLocation('未配置地点')).toThrow(
      InternalServerErrorException,
    );
  });

  it('uses current database permissions instead of the role in the login context', async () => {
    const { service } = createService({
      role: HrRole.Hr,
      managedRegionCodes: [RegionCode.Shanghai],
    });
    const staleAdminAccess: HrAccessContext = {
      hrUserId: HR_ID,
      role: HrRole.Admin,
    };

    await expect(
      service.assertCanManageCalendar(
        staleAdminAccess,
        AttendanceCalendarScope.Global,
        null,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a regular HR to manage only an assigned region', async () => {
    const { service } = createService({
      role: HrRole.Hr,
      managedRegionCodes: [RegionCode.Shanghai],
    });

    await expect(
      service.assertCanManageRegion(ACCESS, RegionCode.Shanghai),
    ).resolves.toBeUndefined();
    await expect(
      service.assertCanManageRegion(ACCESS, RegionCode.Beijing),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows an Admin HR to manage every region and the global calendar', async () => {
    const { service } = createService({
      role: HrRole.Admin,
      managedRegionCodes: [],
    });

    await expect(
      service.assertCanManageRegion(ACCESS, RegionCode.Beijing),
    ).resolves.toBeUndefined();
    await expect(
      service.assertCanManageCalendar(
        ACCESS,
        AttendanceCalendarScope.Global,
        null,
      ),
    ).resolves.toBeUndefined();
    await expect(service.getManagedRegionCodes(ACCESS)).resolves.toEqual(
      Object.values(RegionCode),
    );
    await expect(service.assertAdmin(ACCESS)).resolves.toBeUndefined();
  });

  it('returns the current regular HR calendar access from the database', async () => {
    const { service } = createService({
      role: HrRole.Hr,
      managedRegionCodes: [RegionCode.Shanghai, RegionCode.Online],
    });

    await expect(service.getCalendarAccess(ACCESS)).resolves.toEqual({
      role: HrRole.Hr,
      managedRegionCodes: [RegionCode.Shanghai, RegionCode.Online],
      canManageGlobal: false,
    });
  });

  it('returns all regions and global-calendar access for an Admin HR', async () => {
    const { service } = createService({
      role: HrRole.Admin,
      managedRegionCodes: [],
    });

    await expect(service.getCalendarAccess(ACCESS)).resolves.toEqual({
      role: HrRole.Admin,
      managedRegionCodes: Object.values(RegionCode),
      canManageGlobal: true,
    });
  });

  it('does not allow a regular HR to use Admin attendance settings', async () => {
    const { service } = createService({
      role: HrRole.Hr,
      managedRegionCodes: [RegionCode.Shanghai],
    });

    await expect(service.assertAdmin(ACCESS)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects an invalid calendar scope and region combination', async () => {
    const { service } = createService({
      role: HrRole.Admin,
      managedRegionCodes: [],
    });

    await expect(
      service.assertCanManageCalendar(
        ACCESS,
        AttendanceCalendarScope.Region,
        null,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a missing HR account', async () => {
    const { service } = createService(null);

    await expect(
      service.canManageRegion(ACCESS, RegionCode.Shanghai),
    ).rejects.toThrow(ForbiddenException);
  });
});
