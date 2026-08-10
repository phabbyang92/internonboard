import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { HrRole } from '../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import type { HrUserDocument } from '../auth/schemas/hr-user.schema';
import { OperationAction } from '../operation-log/enums/operation-action.enum';
import { OperationTargetType } from '../operation-log/enums/operation-target-type.enum';
import type { OperationLogService } from '../operation-log/operation-log.service';
import type { RegionAccessService } from './access/region-access.service';
import { RegionCode } from './enums/region-code.enum';
import { HrRegionManagementService } from './hr-region-management.service';

const ADMIN_ID = '6a574ec45bd0f7b2a8b65b99';
const HR_ID = '6a574ec45bd0f7b2a8b65c01';
const ACCESS: HrAccessContext = {
  hrUserId: ADMIN_ID,
  role: HrRole.Admin,
};

function hrUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(HR_ID),
    email: 'shanghai.hr@example.com',
    name: '上海 HR',
    role: HrRole.Hr,
    managedRegionCodes: [RegionCode.Shanghai],
    ...overrides,
  };
}

function queryResult(value: unknown) {
  const query = {
    sort: jest.fn(),
    lean: jest.fn(),
    exec: jest.fn().mockResolvedValue(value),
  };
  query.sort.mockReturnValue(query);
  query.lean.mockReturnValue(query);
  return query;
}

function createService() {
  const model = {
    find: jest.fn(),
    findOne: jest.fn(),
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
    service: new HrRegionManagementService(
      model as unknown as Model<HrUserDocument>,
      regionAccessService as unknown as RegionAccessService,
      operationLogService as unknown as OperationLogService,
    ),
  };
}

describe('HrRegionManagementService', () => {
  it('lists only ordinary HR accounts after checking Admin access', async () => {
    const { service, model, regionAccessService } = createService();
    model.find.mockReturnValue(queryResult([hrUser()]));

    await expect(service.list(ACCESS)).resolves.toEqual({
      items: [
        {
          id: HR_ID,
          email: 'shanghai.hr@example.com',
          name: '上海 HR',
          role: HrRole.Hr,
          managedRegionCodes: [RegionCode.Shanghai],
        },
      ],
    });

    expect(regionAccessService.assertAdmin).toHaveBeenCalledWith(ACCESS);
    expect(model.find).toHaveBeenCalledWith({ role: HrRole.Hr });
  });

  it('updates a regular HR region list and records the permission change', async () => {
    const { service, model, operationLogService } = createService();
    model.findOne.mockReturnValue(queryResult(hrUser()));
    model.findOneAndUpdate.mockReturnValue(
      queryResult(
        hrUser({
          managedRegionCodes: [RegionCode.Beijing, RegionCode.Online],
        }),
      ),
    );

    const result = await service.update(
      HR_ID,
      { managedRegionCodes: [RegionCode.Beijing, RegionCode.Online] },
      ACCESS,
    );

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: new Types.ObjectId(HR_ID), role: HrRole.Hr },
      {
        $set: {
          managedRegionCodes: [RegionCode.Beijing, RegionCode.Online],
        },
      },
      { new: true, runValidators: true },
    );
    expect(operationLogService.record).toHaveBeenCalledWith({
      operatorHrId: ADMIN_ID,
      targetType: OperationTargetType.HrUser,
      targetId: HR_ID,
      action: OperationAction.HrRegionsUpdated,
      changes: {
        before: [RegionCode.Shanghai],
        after: [RegionCode.Beijing, RegionCode.Online],
      },
    });
    expect(result).toMatchObject({
      message: 'HR 地区权限更新成功',
      user: {
        id: HR_ID,
        managedRegionCodes: [RegionCode.Beijing, RegionCode.Online],
      },
    });
  });

  it('rejects an invalid HR account id before querying MongoDB', async () => {
    const { service, model } = createService();

    await expect(
      service.update(
        'invalid-id',
        { managedRegionCodes: [RegionCode.Shanghai] },
        ACCESS,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(model.findOne).not.toHaveBeenCalled();
  });

  it('does not allow changing an Admin account through the ordinary HR endpoint', async () => {
    const { service, model } = createService();
    model.findOne.mockReturnValue(queryResult(null));

    await expect(
      service.update(
        HR_ID,
        { managedRegionCodes: [RegionCode.Shanghai] },
        ACCESS,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
