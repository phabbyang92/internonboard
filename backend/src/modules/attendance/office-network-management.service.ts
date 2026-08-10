import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isIP } from 'node:net';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { OperationAction } from '../operation-log/enums/operation-action.enum';
import { OperationTargetType } from '../operation-log/enums/operation-target-type.enum';
import { OperationLogService } from '../operation-log/operation-log.service';
import { WorkLocation } from '../student/enums/student.enums';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { RegionAccessService } from './access/region-access.service';
import { OFFICE_WORK_LOCATIONS } from './attendance.constants';
import type { UpdateOfficeNetworkDto } from './dto/update-office-network.dto';
import {
  OfficeNetwork,
  type OfficeNetworkDocument,
} from './schemas/office-network.schema';

const OFFICE_LOCATION_SET = new Set<string>(OFFICE_WORK_LOCATIONS);

@Injectable()
export class OfficeNetworkManagementService {
  constructor(
    @InjectModel(OfficeNetwork.name)
    private readonly officeNetworkModel: Model<OfficeNetworkDocument>,
    private readonly regionAccessService: RegionAccessService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async list(access: HrAccessContext) {
    await this.regionAccessService.assertAdmin(access);

    const records = await this.officeNetworkModel
      .find({ workLocation: { $in: OFFICE_WORK_LOCATIONS } })
      .lean()
      .exec();
    const recordByLocation = new Map(
      records.map((record) => [record.workLocation, record]),
    );

    return {
      items: OFFICE_WORK_LOCATIONS.map((workLocation) => {
        const record = recordByLocation.get(workLocation);

        return record
          ? this.toResponse(record)
          : {
              id: null,
              workLocation,
              cidrs: [],
              enabled: false,
              description: null,
              updatedByHrId: null,
              createdAt: null,
              updatedAt: null,
            };
      }),
    };
  }

  async update(
    workLocation: string,
    dto: UpdateOfficeNetworkDto,
    access: HrAccessContext,
  ) {
    await this.regionAccessService.assertAdmin(access);
    const parsedLocation = this.parseOfficeLocation(workLocation);
    const cidrs = dto.cidrs.map((cidr) => this.normalizeIpRange(cidr));

    if (dto.enabled && cidrs.length === 0) {
      throw new BadRequestException('启用办公网络前至少配置一个 IP 或 CIDR');
    }

    const description = dto.description?.trim() || null;
    const updated = await this.officeNetworkModel
      .findOneAndUpdate(
        { workLocation: parsedLocation },
        {
          $set: {
            cidrs,
            enabled: dto.enabled,
            description,
            updatedByHrId: new Types.ObjectId(access.hrUserId),
          },
        },
        { new: true, upsert: true, runValidators: true },
      )
      .lean()
      .exec();

    await this.operationLogService.record({
      operatorHrId: access.hrUserId,
      targetType: OperationTargetType.OfficeNetwork,
      targetId: updated._id.toString(),
      action: OperationAction.OfficeNetworkUpdated,
      changes: {
        workLocation: parsedLocation,
        cidrs,
        enabled: dto.enabled,
        description,
      },
    });

    return {
      message: '办公网络配置保存成功',
      item: this.toResponse(updated),
    };
  }

  private parseOfficeLocation(workLocation: string): WorkLocation {
    if (!OFFICE_LOCATION_SET.has(workLocation)) {
      throw new BadRequestException('当前工作地点不支持办公网络配置');
    }

    return workLocation as WorkLocation;
  }

  private normalizeIpRange(value: string): string {
    const normalized = value.trim();
    const parts = normalized.split('/');
    const address = parts[0];
    const family = address ? isIP(address) : 0;

    if (!normalized || parts.length > 2 || family === 0) {
      throw new BadRequestException(`无效 IP 或 CIDR：${normalized || value}`);
    }

    const maximumPrefix = family === 4 ? 32 : 128;

    if (parts.length === 1) {
      return `${address}/${maximumPrefix}`;
    }

    const prefix = Number(parts[1]);

    if (!Number.isInteger(prefix) || prefix < 0 || prefix > maximumPrefix) {
      throw new BadRequestException(`无效 CIDR 前缀：${normalized}`);
    }

    return `${address}/${prefix}`;
  }

  private toResponse(record: {
    _id: Types.ObjectId;
    workLocation: WorkLocation;
    cidrs: string[];
    enabled: boolean;
    description: string | null;
    updatedByHrId: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: record._id.toString(),
      workLocation: record.workLocation,
      cidrs: record.cidrs,
      enabled: record.enabled,
      description: record.description,
      updatedByHrId: record.updatedByHrId.toString(),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
