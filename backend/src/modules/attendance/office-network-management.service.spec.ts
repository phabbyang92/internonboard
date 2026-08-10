import { BadRequestException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { HrRole } from '../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { OperationAction } from '../operation-log/enums/operation-action.enum';
import { OperationTargetType } from '../operation-log/enums/operation-target-type.enum';
import type { OperationLogService } from '../operation-log/operation-log.service';
import { WorkLocation } from '../student/enums/student.enums';
import type { RegionAccessService } from './access/region-access.service';
import { OFFICE_WORK_LOCATIONS } from './attendance.constants';
import { OfficeNetworkManagementService } from './office-network-management.service';
import type { OfficeNetworkDocument } from './schemas/office-network.schema';

const ADMIN_ID = '6a574ec45bd0f7b2a8b65b99';
const NETWORK_ID = '6a574ec45bd0f7b2a8b65c51';
const ACCESS: HrAccessContext = {
  hrUserId: ADMIN_ID,
  role: HrRole.Admin,
};
const NOW = new Date('2026-08-07T00:00:00.000Z');

function networkRecord(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(NETWORK_ID),
    workLocation: WorkLocation.ShanghaiOffice,
    cidrs: ['140.207.40.253/32'],
    enabled: true,
    description: '会德丰办公室出口 IP',
    updatedByHrId: new Types.ObjectId(ADMIN_ID),
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function queryResult(value: unknown) {
  const query = {
    lean: jest.fn(),
    exec: jest.fn().mockResolvedValue(value),
  };
  query.lean.mockReturnValue(query);
  return query;
}

function createService() {
  const model = {
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
  const regionAccessService = {
    assertAdmin: jest.fn().mockResolvedValue(undefined),
  };
  const operationLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  return {
    model,
    regionAccessService,
    operationLogService,
    service: new OfficeNetworkManagementService(
      model as unknown as Model<OfficeNetworkDocument>,
      regionAccessService as unknown as RegionAccessService,
      operationLogService as unknown as OperationLogService,
    ),
  };
}

describe('OfficeNetworkManagementService', () => {
  it('lists every supported office and fills missing configurations', async () => {
    const { service, model, regionAccessService } = createService();
    model.find.mockReturnValue(queryResult([networkRecord()]));

    const result = await service.list(ACCESS);

    expect(regionAccessService.assertAdmin).toHaveBeenCalledWith(ACCESS);
    expect(result.items).toHaveLength(OFFICE_WORK_LOCATIONS.length);
    expect(result.items).toContainEqual(
      expect.objectContaining({
        workLocation: WorkLocation.ShanghaiOffice,
        cidrs: ['140.207.40.253/32'],
        enabled: true,
      }),
    );
    expect(result.items).toContainEqual({
      id: null,
      workLocation: WorkLocation.BeijingOffice,
      cidrs: [],
      enabled: false,
      description: null,
      updatedByHrId: null,
      createdAt: null,
      updatedAt: null,
    });
  });

  it('normalizes a plain IP, upserts the office, and records an operation log', async () => {
    const { service, model, operationLogService } = createService();
    model.findOneAndUpdate.mockReturnValue(queryResult(networkRecord()));

    const result = await service.update(
      WorkLocation.ShanghaiOffice,
      {
        cidrs: ['140.207.40.253'],
        enabled: true,
        description: ' 会德丰办公室出口 IP ',
      },
      ACCESS,
    );

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { workLocation: WorkLocation.ShanghaiOffice },
      {
        $set: {
          cidrs: ['140.207.40.253/32'],
          enabled: true,
          description: '会德丰办公室出口 IP',
          updatedByHrId: new Types.ObjectId(ADMIN_ID),
        },
      },
      { new: true, upsert: true, runValidators: true },
    );
    expect(operationLogService.record).toHaveBeenCalledWith({
      operatorHrId: ADMIN_ID,
      targetType: OperationTargetType.OfficeNetwork,
      targetId: NETWORK_ID,
      action: OperationAction.OfficeNetworkUpdated,
      changes: {
        workLocation: WorkLocation.ShanghaiOffice,
        cidrs: ['140.207.40.253/32'],
        enabled: true,
        description: '会德丰办公室出口 IP',
      },
    });
    expect(result.message).toBe('办公网络配置保存成功');
  });

  it('rejects enabling an office without an IP range', async () => {
    const { service, model } = createService();

    await expect(
      service.update(
        WorkLocation.ShanghaiOffice,
        { cidrs: [], enabled: true },
        ACCESS,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects unsupported locations and invalid CIDR values', async () => {
    const { service, model } = createService();

    await expect(
      service.update(
        WorkLocation.Online,
        { cidrs: ['140.207.40.253/32'], enabled: true },
        ACCESS,
      ),
    ).rejects.toThrow('当前工作地点不支持办公网络配置');
    await expect(
      service.update(
        WorkLocation.ShanghaiOffice,
        { cidrs: ['140.207.40.253/99'], enabled: true },
        ACCESS,
      ),
    ).rejects.toThrow('无效 CIDR 前缀');
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
