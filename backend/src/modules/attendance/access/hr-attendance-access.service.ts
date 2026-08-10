import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, QueryFilter } from 'mongoose';
import { isValidObjectId, Types } from 'mongoose';
import { HrRole } from '../../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../../auth/interfaces/hr-access-context.interface';
import { HrUser, type HrUserDocument } from '../../auth/schemas/hr-user.schema';
import { StudentService } from '../../student/student.service';
import type { AttendanceRecord } from '../schemas/attendance-record.schema';

export interface HrAttendanceAccessScope {
  access: HrAccessContext;
  ownerHrId: Types.ObjectId | null;
}

@Injectable()
export class HrAttendanceAccessService {
  constructor(
    @InjectModel(HrUser.name)
    private readonly hrUserModel: Model<HrUserDocument>,
    private readonly studentService: StudentService,
  ) {}

  async scopeAttendanceRecordFilter(
    filter: QueryFilter<AttendanceRecord>,
    access: HrAccessContext,
    requestedOwnerHrId?: string,
  ): Promise<QueryFilter<AttendanceRecord>> {
    const scope = await this.resolveAttendanceScope(access, requestedOwnerHrId);
    const scopedFilter = { ...filter };

    // ownerHrId 只能由权限层写入，调用方传入的同名条件不能绕过权限范围。
    delete scopedFilter.ownerHrId;

    if (scope.ownerHrId) {
      scopedFilter.ownerHrId = scope.ownerHrId;
    }

    return scopedFilter;
  }

  async resolveAttendanceScope(
    access: HrAccessContext,
    requestedOwnerHrId?: string,
  ): Promise<HrAttendanceAccessScope> {
    const currentRole = await this.loadCurrentRole(access.hrUserId);

    if (currentRole === HrRole.Admin) {
      return {
        access: { hrUserId: access.hrUserId, role: HrRole.Admin },
        ownerHrId: requestedOwnerHrId
          ? this.parseOwnerHrId(requestedOwnerHrId)
          : null,
      };
    }

    const currentHrObjectId = new Types.ObjectId(access.hrUserId);

    if (
      requestedOwnerHrId &&
      !currentHrObjectId.equals(this.parseOwnerHrId(requestedOwnerHrId))
    ) {
      throw new ForbiddenException('普通 HR 只能查询自己负责学生的考勤');
    }

    return {
      access: { hrUserId: access.hrUserId, role: HrRole.Hr },
      ownerHrId: currentHrObjectId,
    };
  }

  async getAccessibleStudent(studentId: string, access: HrAccessContext) {
    const scope = await this.resolveAttendanceScope(access);

    // 复用学生模块的归属查询；无权访问和记录不存在都统一返回“学生不存在”。
    return this.studentService.findOneByIdForHr(studentId, scope.access);
  }

  private async loadCurrentRole(hrUserId: string): Promise<HrRole> {
    if (!isValidObjectId(hrUserId)) {
      throw new ForbiddenException('HR 账号无效');
    }

    const hrUser = await this.hrUserModel
      .findById(hrUserId)
      .select({ role: 1 })
      .lean()
      .exec();

    if (!hrUser) {
      throw new ForbiddenException('HR 账号不存在');
    }

    return hrUser.role;
  }

  private parseOwnerHrId(ownerHrId: string): Types.ObjectId {
    if (!isValidObjectId(ownerHrId)) {
      throw new BadRequestException('负责人 HR ID 格式错误');
    }

    return new Types.ObjectId(ownerHrId);
  }
}
