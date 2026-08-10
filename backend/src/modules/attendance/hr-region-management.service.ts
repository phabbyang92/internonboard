import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Types } from 'mongoose';
import type { Model } from 'mongoose';
import { HrRole } from '../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { HrUser, type HrUserDocument } from '../auth/schemas/hr-user.schema';
import { OperationAction } from '../operation-log/enums/operation-action.enum';
import { OperationTargetType } from '../operation-log/enums/operation-target-type.enum';
import { OperationLogService } from '../operation-log/operation-log.service';
import { RegionAccessService } from './access/region-access.service';
import type { UpdateHrRegionsDto } from './dto/update-hr-regions.dto';

@Injectable()
export class HrRegionManagementService {
  constructor(
    @InjectModel(HrUser.name)
    private readonly hrUserModel: Model<HrUserDocument>,
    private readonly regionAccessService: RegionAccessService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async list(access: HrAccessContext) {
    await this.regionAccessService.assertAdmin(access);

    const users = await this.hrUserModel
      .find({ role: HrRole.Hr })
      .sort({ name: 1, email: 1 })
      .lean()
      .exec();

    return { items: users.map((user) => this.toResponse(user)) };
  }

  async update(
    hrUserId: string,
    dto: UpdateHrRegionsDto,
    access: HrAccessContext,
  ) {
    await this.regionAccessService.assertAdmin(access);

    if (!isValidObjectId(hrUserId)) {
      throw new BadRequestException('HR 账号 ID 格式错误');
    }

    const objectId = new Types.ObjectId(hrUserId);
    const existing = await this.hrUserModel
      .findOne({ _id: objectId, role: HrRole.Hr })
      .lean()
      .exec();

    if (!existing) {
      throw new NotFoundException('普通 HR 账号不存在');
    }

    const updated = await this.hrUserModel
      .findOneAndUpdate(
        { _id: objectId, role: HrRole.Hr },
        { $set: { managedRegionCodes: dto.managedRegionCodes } },
        { new: true, runValidators: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException('普通 HR 账号不存在');
    }

    await this.operationLogService.record({
      operatorHrId: access.hrUserId,
      targetType: OperationTargetType.HrUser,
      targetId: hrUserId,
      action: OperationAction.HrRegionsUpdated,
      changes: {
        before: existing.managedRegionCodes ?? [],
        after: updated.managedRegionCodes ?? [],
      },
    });

    return {
      message: 'HR 地区权限更新成功',
      user: this.toResponse(updated),
    };
  }

  private toResponse(user: {
    _id: Types.ObjectId;
    email: string;
    name: string;
    role: HrRole;
    managedRegionCodes?: string[];
  }) {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      managedRegionCodes: user.managedRegionCodes ?? [],
    };
  }
}
