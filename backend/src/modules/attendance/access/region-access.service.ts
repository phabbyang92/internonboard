import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { isValidObjectId } from 'mongoose';
import { HrRole } from '../../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../../auth/interfaces/hr-access-context.interface';
import { HrUser, type HrUserDocument } from '../../auth/schemas/hr-user.schema';
import { AttendanceCalendarScope } from '../enums/attendance-calendar-scope.enum';
import { RegionCode } from '../enums/region-code.enum';
import { WORK_LOCATION_REGION_MAP } from './work-location-region.map';

interface CurrentHrRegionAccess {
  role: HrRole;
  managedRegionCodes: RegionCode[];
}

export interface CalendarAccessResponse {
  role: HrRole;
  managedRegionCodes: RegionCode[];
  canManageGlobal: boolean;
}

@Injectable()
export class RegionAccessService {
  constructor(
    @InjectModel(HrUser.name)
    private readonly hrUserModel: Model<HrUserDocument>,
  ) {}

  getRegionForWorkLocation(workLocation: string): RegionCode {
    const regionCode = WORK_LOCATION_REGION_MAP[workLocation];

    if (!regionCode) {
      // 新增工作地点时必须同步维护映射，否则考勤日历会应用到错误地区。
      throw new InternalServerErrorException(
        `工作地点尚未配置考勤地区: ${workLocation}`,
      );
    }

    return regionCode;
  }

  async getManagedRegionCodes(access: HrAccessContext): Promise<RegionCode[]> {
    const currentAccess = await this.loadCurrentHrAccess(access.hrUserId);

    if (currentAccess.role === HrRole.Admin) {
      return Object.values(RegionCode);
    }

    return currentAccess.managedRegionCodes;
  }

  async getCalendarAccess(
    access: HrAccessContext,
  ): Promise<CalendarAccessResponse> {
    const currentAccess = await this.loadCurrentHrAccess(access.hrUserId);
    const isAdmin = currentAccess.role === HrRole.Admin;

    return {
      role: currentAccess.role,
      managedRegionCodes: isAdmin
        ? Object.values(RegionCode)
        : currentAccess.managedRegionCodes,
      canManageGlobal: isAdmin,
    };
  }

  async assertAdmin(access: HrAccessContext): Promise<void> {
    const currentAccess = await this.loadCurrentHrAccess(access.hrUserId);

    // 不只信任 JWT 中的旧角色，保证账号降权后立即失去管理权限。
    if (currentAccess.role !== HrRole.Admin) {
      throw new ForbiddenException('只有 Admin HR 可以管理该配置');
    }
  }

  async canManageRegion(
    access: HrAccessContext,
    regionCode: RegionCode,
  ): Promise<boolean> {
    const currentAccess = await this.loadCurrentHrAccess(access.hrUserId);

    return (
      currentAccess.role === HrRole.Admin ||
      currentAccess.managedRegionCodes.includes(regionCode)
    );
  }

  async assertCanManageRegion(
    access: HrAccessContext,
    regionCode: RegionCode,
  ): Promise<void> {
    if (!(await this.canManageRegion(access, regionCode))) {
      throw new ForbiddenException('无权管理该地区的考勤配置');
    }
  }

  async assertCanManageCalendar(
    access: HrAccessContext,
    scope: AttendanceCalendarScope,
    regionCode: RegionCode | null,
  ): Promise<void> {
    if (scope === AttendanceCalendarScope.Global && regionCode !== null) {
      throw new BadRequestException('全国假期不能指定地区');
    }

    if (scope === AttendanceCalendarScope.Region && regionCode === null) {
      throw new BadRequestException('地区假期必须指定地区');
    }

    const currentAccess = await this.loadCurrentHrAccess(access.hrUserId);

    // 全国假期会影响所有学生，因此只能由 Admin HR 维护。
    if (scope === AttendanceCalendarScope.Global) {
      if (currentAccess.role !== HrRole.Admin) {
        throw new ForbiddenException('只有 Admin HR 可以管理全国假期');
      }

      return;
    }

    if (
      currentAccess.role !== HrRole.Admin &&
      !currentAccess.managedRegionCodes.includes(regionCode as RegionCode)
    ) {
      throw new ForbiddenException('无权管理该地区的考勤配置');
    }
  }

  private async loadCurrentHrAccess(
    hrUserId: string,
  ): Promise<CurrentHrRegionAccess> {
    if (!isValidObjectId(hrUserId)) {
      throw new ForbiddenException('HR 账号无效');
    }

    // 每次敏感操作读取数据库，权限调整后无需等待旧登录态过期。
    const hrUser = await this.hrUserModel
      .findById(hrUserId)
      .select({ role: 1, managedRegionCodes: 1 })
      .lean()
      .exec();

    if (!hrUser) {
      throw new ForbiddenException('HR 账号不存在');
    }

    return {
      role: hrUser.role,
      managedRegionCodes: hrUser.managedRegionCodes ?? [],
    };
  }
}
