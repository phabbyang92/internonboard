import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { HrRole } from '../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { OperationAction } from '../operation-log/enums/operation-action.enum';
import { OperationTargetType } from '../operation-log/enums/operation-target-type.enum';
import type { OperationLogService } from '../operation-log/operation-log.service';
import type { RegionAccessService } from './access/region-access.service';
import { AttendanceCalendarManagementService } from './attendance-calendar-management.service';
import { AttendanceCalendarScope } from './enums/attendance-calendar-scope.enum';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import { CalendarExceptionType } from './enums/calendar-exception-type.enum';
import { RegionCode } from './enums/region-code.enum';
import type { AttendanceCalendarDocument } from './schemas/attendance-calendar.schema';

const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const CALENDAR_ID = '6a574ec45bd0f7b2a8b65c41';
const ACCESS: HrAccessContext = { hrUserId: HR_ID, role: HrRole.Admin };
const REGULAR_ACCESS: HrAccessContext = {
  hrUserId: HR_ID,
  role: HrRole.Hr,
};
const CREATED_AT = new Date('2026-08-01T00:00:00.000Z');
const UPDATED_AT = new Date('2026-08-02T00:00:00.000Z');

function calendarRecord(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(CALENDAR_ID),
    date: '2026-10-01',
    name: '国庆节',
    type: CalendarExceptionType.PublicHoliday,
    scope: AttendanceCalendarScope.Global,
    regionCode: null,
    reason: null,
    createdByHrId: new Types.ObjectId(HR_ID),
    updatedByHrId: new Types.ObjectId(HR_ID),
    isDeleted: false,
    deletedAt: null,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

function queryResult(value: unknown) {
  const query = {
    sort: jest.fn(),
    select: jest.fn(),
    lean: jest.fn(),
    exec: jest.fn().mockResolvedValue(value),
  };
  query.sort.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.lean.mockReturnValue(query);
  return query;
}

function createService() {
  const model = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    insertMany: jest.fn(),
  };
  const regionAccessService = {
    assertAdmin: jest.fn().mockResolvedValue(undefined),
    getManagedRegionCodes: jest
      .fn()
      .mockResolvedValue(Object.values(RegionCode)),
    assertCanManageCalendar: jest.fn().mockResolvedValue(undefined),
  };
  const operationLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  return {
    model,
    regionAccessService,
    operationLogService,
    service: new AttendanceCalendarManagementService(
      model as unknown as Model<AttendanceCalendarDocument>,
      regionAccessService as unknown as RegionAccessService,
      operationLogService as unknown as OperationLogService,
    ),
  };
}

describe('AttendanceCalendarManagementService', () => {
  it('lists global and managed-region records using current database access', async () => {
    const { service, model, regionAccessService } = createService();
    regionAccessService.getManagedRegionCodes.mockResolvedValueOnce([
      RegionCode.Shanghai,
    ]);
    model.find.mockReturnValue(queryResult([calendarRecord()]));

    const result = await service.list({ month: '2026-10' }, REGULAR_ACCESS);

    expect(regionAccessService.getManagedRegionCodes).toHaveBeenCalledWith(
      REGULAR_ACCESS,
    );
    expect(model.find).toHaveBeenCalledWith({
      isDeleted: false,
      date: { $gte: '2026-10-01', $lte: '2026-10-31' },
      $or: [
        {
          scope: AttendanceCalendarScope.Global,
          regionCode: null,
        },
        {
          scope: AttendanceCalendarScope.Region,
          regionCode: { $in: [RegionCode.Shanghai] },
        },
      ],
    });
    expect(result.items[0]).toMatchObject({
      id: CALENDAR_ID,
      date: '2026-10-01',
      scope: AttendanceCalendarScope.Global,
    });
  });

  it('rejects reading a region that the current HR does not manage', async () => {
    const { service, model, regionAccessService } = createService();
    regionAccessService.getManagedRegionCodes.mockResolvedValueOnce([
      RegionCode.Shanghai,
    ]);

    await expect(
      service.list(
        {
          month: '2026-10',
          scope: AttendanceCalendarScope.Region,
          regionCode: RegionCode.Beijing,
        },
        REGULAR_ACCESS,
      ),
    ).rejects.toThrow('无权查看该地区的考勤配置');
    expect(model.find).not.toHaveBeenCalled();
  });

  it('does not query calendar data when a regular HR cannot create the target scope', async () => {
    const { service, model, regionAccessService } = createService();
    regionAccessService.assertCanManageCalendar.mockRejectedValueOnce(
      new BadRequestException('forbidden'),
    );

    await expect(
      service.create(
        {
          startDate: '2026-10-01',
          endDate: '2026-10-01',
          name: '无权假期',
          scope: AttendanceCalendarScope.Global,
        },
        REGULAR_ACCESS,
      ),
    ).rejects.toThrow();
    expect(model.findOne).not.toHaveBeenCalled();
    expect(model.insertMany).not.toHaveBeenCalled();
  });

  it('expands a global date range and derives public-holiday fields', async () => {
    const { service, model, regionAccessService, operationLogService } =
      createService();
    let insertedRows: Array<Record<string, unknown>> = [];
    model.findOne.mockReturnValue(queryResult(null));
    model.insertMany.mockImplementation(
      (rows: Array<Record<string, unknown>>) => {
        insertedRows = rows;
        return Promise.resolve(
          rows.map((row, index) =>
            calendarRecord({
              ...row,
              _id: new Types.ObjectId(
                index === 0
                  ? '6a574ec45bd0f7b2a8b65c41'
                  : '6a574ec45bd0f7b2a8b65c42',
              ),
              createdAt: CREATED_AT,
              updatedAt: UPDATED_AT,
            }),
          ),
        );
      },
    );

    const result = await service.create(
      {
        startDate: '2026-10-01',
        endDate: '2026-10-02',
        name: '国庆节',
        scope: AttendanceCalendarScope.Global,
      },
      ACCESS,
    );

    expect(result.createdCount).toBe(2);
    expect(insertedRows.map((row) => row.date)).toEqual([
      '2026-10-01',
      '2026-10-02',
    ]);
    expect(insertedRows[0]).toMatchObject({
      type: CalendarExceptionType.PublicHoliday,
      scope: AttendanceCalendarScope.Global,
      regionCode: null,
      createdByHrId: new Types.ObjectId(HR_ID),
    });
    expect(regionAccessService.assertCanManageCalendar).toHaveBeenCalledWith(
      ACCESS,
      AttendanceCalendarScope.Global,
      null,
    );
    const createLogCalls = operationLogService.record.mock
      .calls as unknown as Array<
      [
        {
          operatorHrId: string;
          targetType: OperationTargetType;
          targetId: string;
          action: OperationAction;
          changes: { createdCount: number };
        },
      ]
    >;
    const createLogCall = createLogCalls[0][0];
    expect(createLogCall).toMatchObject({
      operatorHrId: HR_ID,
      targetType: OperationTargetType.AttendanceCalendar,
      targetId: CALENDAR_ID,
      action: OperationAction.AttendanceCalendarCreated,
      changes: { createdCount: 2 },
    });
  });

  it('derives temporary-holiday fields for a regional configuration', async () => {
    const { service, model, regionAccessService } = createService();
    let insertedRows: Array<Record<string, unknown>> = [];
    model.findOne.mockReturnValue(queryResult(null));
    model.insertMany.mockImplementation(
      (rows: Array<Record<string, unknown>>) => {
        insertedRows = rows;
        return Promise.resolve([
          calendarRecord({
            type: CalendarExceptionType.TemporaryHoliday,
            scope: AttendanceCalendarScope.Region,
            regionCode: RegionCode.Shanghai,
          }),
        ]);
      },
    );

    await service.create(
      {
        startDate: '2026-10-01',
        endDate: '2026-10-01',
        name: '上海临时假期',
        scope: AttendanceCalendarScope.Region,
        regionCode: RegionCode.Shanghai,
      },
      ACCESS,
    );

    expect(insertedRows[0]).toMatchObject({
      type: CalendarExceptionType.TemporaryHoliday,
      scope: AttendanceCalendarScope.Region,
      regionCode: RegionCode.Shanghai,
    });
    expect(regionAccessService.assertCanManageCalendar).toHaveBeenCalledWith(
      ACCESS,
      AttendanceCalendarScope.Region,
      RegionCode.Shanghai,
    );
  });

  it.each([
    {
      startDate: '2026-10-02',
      endDate: '2026-10-01',
      code: AttendanceErrorCode.CalendarDateRangeInvalid,
    },
    {
      startDate: '2026-02-30',
      endDate: '2026-03-01',
      code: AttendanceErrorCode.CalendarDateRangeInvalid,
    },
    {
      startDate: '2026-01-01',
      endDate: '2027-01-02',
      code: AttendanceErrorCode.CalendarDateRangeTooLarge,
    },
  ])('rejects an invalid calendar range: %o', async (testCase) => {
    const { service, model } = createService();

    await expect(
      service.create(
        {
          startDate: testCase.startDate,
          endDate: testCase.endDate,
          name: '测试假期',
          scope: AttendanceCalendarScope.Global,
        },
        ACCESS,
      ),
    ).rejects.toMatchObject({ response: { code: testCase.code } });
    expect(model.insertMany).not.toHaveBeenCalled();
  });

  it('rejects a regional configuration without a region', async () => {
    const { service } = createService();

    await expect(
      service.create(
        {
          startDate: '2026-10-01',
          endDate: '2026-10-01',
          name: '临时假期',
          scope: AttendanceCalendarScope.Region,
        },
        ACCESS,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns a conflict before inserting a duplicate active date', async () => {
    const { service, model } = createService();
    model.findOne.mockReturnValue(queryResult(calendarRecord()));

    await expect(
      service.create(
        {
          startDate: '2026-10-01',
          endDate: '2026-10-02',
          name: '重复假期',
          scope: AttendanceCalendarScope.Global,
        },
        ACCESS,
      ),
    ).rejects.toThrow(ConflictException);
    expect(model.insertMany).not.toHaveBeenCalled();
  });

  it('updates a single active calendar record', async () => {
    const { service, model, regionAccessService, operationLogService } =
      createService();
    model.findOne
      .mockReturnValueOnce(queryResult(calendarRecord()))
      .mockReturnValueOnce(queryResult(null));
    model.findOneAndUpdate.mockReturnValue(
      queryResult(calendarRecord({ name: '国庆假期' })),
    );

    const result = await service.update(
      CALENDAR_ID,
      { name: '国庆假期' },
      ACCESS,
    );

    expect(result.name).toBe('国庆假期');
    const updateCall = model.findOneAndUpdate.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { $set: Record<string, unknown> },
      Record<string, unknown>,
    ];
    expect(updateCall[0]).toEqual({
      _id: new Types.ObjectId(CALENDAR_ID),
      isDeleted: false,
    });
    expect(updateCall[1].$set).toMatchObject({ name: '国庆假期' });
    expect(updateCall[2]).toEqual({ new: true, runValidators: true });
    expect(regionAccessService.assertCanManageCalendar).toHaveBeenNthCalledWith(
      1,
      ACCESS,
      AttendanceCalendarScope.Global,
      null,
    );
    const updateLogCalls = operationLogService.record.mock
      .calls as unknown as Array<
      [
        {
          targetType: OperationTargetType;
          targetId: string;
          action: OperationAction;
          changes: {
            before: { name: string };
            after: { name: string };
          };
        },
      ]
    >;
    const updateLogCall = updateLogCalls[0][0];
    expect(updateLogCall).toMatchObject({
      targetType: OperationTargetType.AttendanceCalendar,
      targetId: CALENDAR_ID,
      action: OperationAction.AttendanceCalendarUpdated,
      changes: {
        before: { name: '国庆节' },
        after: { name: '国庆假期' },
      },
    });
  });

  it('checks both the existing and destination region before moving a record', async () => {
    const { service, model, regionAccessService } = createService();
    model.findOne.mockReturnValueOnce(
      queryResult(
        calendarRecord({
          type: CalendarExceptionType.TemporaryHoliday,
          scope: AttendanceCalendarScope.Region,
          regionCode: RegionCode.Shanghai,
        }),
      ),
    );
    regionAccessService.assertCanManageCalendar
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new BadRequestException('forbidden'));

    await expect(
      service.update(
        CALENDAR_ID,
        { regionCode: RegionCode.Beijing },
        REGULAR_ACCESS,
      ),
    ).rejects.toThrow();

    expect(regionAccessService.assertCanManageCalendar).toHaveBeenNthCalledWith(
      1,
      REGULAR_ACCESS,
      AttendanceCalendarScope.Region,
      RegionCode.Shanghai,
    );
    expect(regionAccessService.assertCanManageCalendar).toHaveBeenNthCalledWith(
      2,
      REGULAR_ACCESS,
      AttendanceCalendarScope.Region,
      RegionCode.Beijing,
    );
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('soft-deletes a calendar record', async () => {
    const { service, model, regionAccessService, operationLogService } =
      createService();
    model.findOne.mockReturnValue(queryResult(calendarRecord()));
    model.findOneAndUpdate.mockReturnValue(
      queryResult(calendarRecord({ isDeleted: true })),
    );

    const result = await service.remove(CALENDAR_ID, ACCESS);

    expect(result.id).toBe(CALENDAR_ID);
    const deleteCall = model.findOneAndUpdate.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { $set: Record<string, unknown> },
      Record<string, unknown>,
    ];
    expect(deleteCall[0]).toEqual({
      _id: new Types.ObjectId(CALENDAR_ID),
      isDeleted: false,
    });
    expect(deleteCall[1].$set).toMatchObject({ isDeleted: true });
    expect(deleteCall[2]).toEqual({ new: true });
    expect(regionAccessService.assertCanManageCalendar).toHaveBeenCalledWith(
      ACCESS,
      AttendanceCalendarScope.Global,
      null,
    );
    expect(operationLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: OperationTargetType.AttendanceCalendar,
        targetId: CALENDAR_ID,
        action: OperationAction.AttendanceCalendarDeleted,
      }),
    );
  });

  it('returns not found for a missing active record', async () => {
    const { service, model } = createService();
    model.findOne.mockReturnValue(queryResult(null));

    await expect(
      service.update(CALENDAR_ID, { name: '不存在' }, ACCESS),
    ).rejects.toThrow(NotFoundException);
  });

  it('stops before reading calendar data when current HR access cannot load', async () => {
    const { service, model, regionAccessService } = createService();
    regionAccessService.getManagedRegionCodes.mockRejectedValueOnce(
      new BadRequestException('not admin'),
    );

    await expect(service.list({ month: '2026-10' }, ACCESS)).rejects.toThrow();
    expect(model.find).not.toHaveBeenCalled();
  });
});
