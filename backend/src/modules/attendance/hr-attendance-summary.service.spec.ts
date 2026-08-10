import type { Model, PipelineStage } from 'mongoose';
import { Types } from 'mongoose';
import { HrRole } from '../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { WorkLocation } from '../student/enums/student.enums';
import type { HrAttendanceAccessService } from './access/hr-attendance-access.service';
import type { AttendanceQueryPreparationService } from './attendance-query-preparation.service';
import type { ListHrAttendanceSummaryQueryDto } from './dto/list-hr-attendance-summary-query.dto';
import { CheckInMode } from './enums/check-in-mode.enum';
import { HrAttendanceSummarySort } from './enums/hr-attendance-sort.enum';
import { HrAttendanceSummaryService } from './hr-attendance-summary.service';
import type { AttendanceRecordDocument } from './schemas/attendance-record.schema';

const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const ACCESS: HrAccessContext = { hrUserId: HR_ID, role: HrRole.Hr };

function createQuery(
  overrides: Partial<ListHrAttendanceSummaryQueryDto> = {},
): ListHrAttendanceSummaryQueryDto {
  return {
    month: '2026-08',
    page: 1,
    limit: 20,
    sortBy: HrAttendanceSummarySort.StudentNameAsc,
    ...overrides,
  };
}

function createService(aggregateResult: unknown) {
  const exec = jest.fn().mockResolvedValue(aggregateResult);
  let capturedPipeline: PipelineStage[] | undefined;
  const aggregate = jest.fn((pipeline: PipelineStage[]) => {
    capturedPipeline = pipeline;
    return { exec };
  });
  const model = { aggregate };
  const accessService = {
    resolveAttendanceScope: jest.fn().mockResolvedValue({
      access: ACCESS,
      ownerHrId: new Types.ObjectId(HR_ID),
    }),
  };
  const queryPreparationService = {
    prepareHrMonth: jest.fn().mockResolvedValue(undefined),
  };

  return {
    model,
    accessService,
    queryPreparationService,
    getPipeline: () => {
      if (!capturedPipeline) {
        throw new Error('Attendance summary pipeline was not generated');
      }

      return capturedPipeline;
    },
    service: new HrAttendanceSummaryService(
      model as unknown as Model<AttendanceRecordDocument>,
      accessService as unknown as HrAttendanceAccessService,
      queryPreparationService as unknown as AttendanceQueryPreparationService,
    ),
  };
}

describe('HrAttendanceSummaryService', () => {
  it('reconciles, scopes, filters and serializes monthly student summaries', async () => {
    const latestCheckInAt = new Date('2026-08-20T01:50:00.000Z');
    const aggregateResult = [
      {
        metadata: [{ total: 1 }],
        items: [
          {
            studentId: new Types.ObjectId(STUDENT_ID),
            studentName: '测试学生',
            studentEmail: 'student@example.com',
            ownerHrId: new Types.ObjectId(HR_ID),
            ownerHrName: '上海 HR',
            totalAttendanceDays: 12,
            lateDates: ['2026-08-12', '2026-08-03'],
            leaveDates: ['2026-08-08'],
            absentDates: ['2026-08-18'],
            onlineAttendanceDays: 5,
            offlineAttendanceDays: 7,
            latestCheckInAt,
            latestAttendanceDate: '2026-08-20',
            latestAssignedWorkLocation: WorkLocation.ShanghaiOffice,
            latestCheckInMode: CheckInMode.Offline,
            latestCheckInLocation: WorkLocation.ShanghaiOffice,
          },
        ],
      },
    ];
    const {
      service,
      model,
      accessService,
      queryPreparationService,
      getPipeline,
    } = createService(aggregateResult);
    const query = createQuery({
      keyword: '测试.*',
      workLocation: WorkLocation.ShanghaiOffice,
      checkInMode: CheckInMode.Offline,
      ownerHrId: HR_ID,
      sortBy: HrAttendanceSummarySort.TotalAttendanceDaysDesc,
    });

    const result = await service.listSummary(query, ACCESS);

    expect(accessService.resolveAttendanceScope).toHaveBeenCalledWith(
      ACCESS,
      HR_ID,
    );
    expect(queryPreparationService.prepareHrMonth).toHaveBeenCalledWith(
      query.month,
      ACCESS,
      undefined,
      HR_ID,
    );
    expect(model.aggregate).toHaveBeenCalledTimes(1);
    expect(getPipeline()[0]).toEqual({
      $match: {
        attendanceDate: {
          $gte: '2026-08-01',
          $lt: '2026-09-01',
        },
        ownerHrId: new Types.ObjectId(HR_ID),
        assignedWorkLocation: WorkLocation.ShanghaiOffice,
        checkInMode: CheckInMode.Offline,
      },
    });
    expect(
      getPipeline().find((stage) => '$match' in stage && '$or' in stage.$match),
    ).toBeDefined();

    expect(result).toEqual({
      month: '2026-08',
      items: [
        {
          student: {
            id: STUDENT_ID,
            name: '测试学生',
            email: 'student@example.com',
            ownerHr: { id: HR_ID, name: '上海 HR' },
          },
          summary: {
            totalAttendanceDays: 12,
            late: {
              count: 2,
              dates: ['2026-08-03', '2026-08-12'],
            },
            leave: { count: 1, dates: ['2026-08-08'] },
            absent: { count: 1, dates: ['2026-08-18'] },
            onlineAttendanceDays: 5,
            offlineAttendanceDays: 7,
            latestCheckIn: {
              attendanceDate: '2026-08-20',
              checkInAt: latestCheckInAt,
              assignedWorkLocation: WorkLocation.ShanghaiOffice,
              checkInMode: CheckInMode.Offline,
              checkInLocation: WorkLocation.ShanghaiOffice,
            },
          },
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it('builds attendance, status-date, mode and latest-check-in accumulators', async () => {
    const { service, getPipeline } = createService([
      { metadata: [], items: [] },
    ]);

    await service.listSummary(createQuery(), ACCESS);

    const groupStage = getPipeline().find((stage) => '$group' in stage);
    expect(groupStage).toBeDefined();

    if (!groupStage || !('$group' in groupStage)) {
      throw new Error('Attendance summary group was not generated');
    }

    expect(groupStage.$group).toMatchObject({
      totalAttendanceDays: {
        $sum: {
          $cond: [{ $in: ['$status', ['on_time', 'late']] }, 1, 0],
        },
      },
      lateDates: {
        $push: {
          $cond: [{ $eq: ['$status', 'late'] }, '$attendanceDate', null],
        },
      },
      onlineAttendanceDays: {
        $sum: {
          $cond: [
            {
              $and: [
                { $in: ['$status', ['on_time', 'late']] },
                { $eq: ['$checkInMode', 'online'] },
              ],
            },
            1,
            0,
          ],
        },
      },
      latestCheckInAt: { $first: '$checkInAt' },
    });
  });

  it('prepares and queries all owners for an unfiltered Admin', async () => {
    const adminAccess: HrAccessContext = {
      hrUserId: HR_ID,
      role: HrRole.Admin,
    };
    const { service, accessService, queryPreparationService, getPipeline } =
      createService([{ metadata: [], items: [] }]);
    accessService.resolveAttendanceScope.mockResolvedValue({
      access: adminAccess,
      ownerHrId: null,
    });

    await service.listSummary(createQuery(), adminAccess);

    expect(queryPreparationService.prepareHrMonth).toHaveBeenCalledWith(
      '2026-08',
      adminAccess,
      undefined,
      null,
    );
    expect(getPipeline()[0]).toEqual({
      $match: {
        attendanceDate: {
          $gte: '2026-08-01',
          $lt: '2026-09-01',
        },
      },
    });
  });

  it('uses an exclusive next-year boundary for a December summary', async () => {
    const { service, getPipeline } = createService([
      { metadata: [], items: [] },
    ]);

    await service.listSummary(createQuery({ month: '2026-12' }), ACCESS);

    expect(getPipeline()[0]).toEqual({
      $match: {
        attendanceDate: {
          $gte: '2026-12-01',
          $lt: '2027-01-01',
        },
        ownerHrId: new Types.ObjectId(HR_ID),
      },
    });
  });

  it.each([
    [HrAttendanceSummarySort.StudentNameAsc, { _studentNameSort: 1, _id: 1 }],
    [
      HrAttendanceSummarySort.TotalAttendanceDaysDesc,
      { totalAttendanceDays: -1, _studentNameSort: 1, _id: 1 },
    ],
    [
      HrAttendanceSummarySort.LatestCheckInAtDesc,
      {
        _latestCheckInMissing: 1,
        latestCheckInAt: -1,
        _studentNameSort: 1,
        _id: 1,
      },
    ],
  ])('applies the %s summary sort', async (sortBy, expectedSort) => {
    const { service, getPipeline } = createService([
      { metadata: [], items: [] },
    ]);

    await service.listSummary(createQuery({ sortBy }), ACCESS);

    const facetStage = getPipeline().find((stage) => '$facet' in stage);
    if (!facetStage || !('$facet' in facetStage)) {
      throw new Error('Attendance summary facet was not generated');
    }

    expect(facetStage.$facet.items[0]).toEqual({ $sort: expectedSort });
  });

  it('paginates grouped students inside the database facet', async () => {
    const { service, getPipeline } = createService([
      { metadata: [], items: [] },
    ]);

    await service.listSummary(createQuery({ page: 3, limit: 10 }), ACCESS);

    const facetStage = getPipeline().find((stage) => '$facet' in stage);
    if (!facetStage || !('$facet' in facetStage)) {
      throw new Error('Attendance summary facet was not generated');
    }

    expect(facetStage.$facet.metadata).toEqual([{ $count: 'total' }]);
    expect(facetStage.$facet.items.slice(0, 3)).toEqual([
      { $sort: { _studentNameSort: 1, _id: 1 } },
      { $skip: 20 },
      { $limit: 10 },
    ]);
  });

  it('returns stable pagination when a month has no attendance records', async () => {
    const { service } = createService([{ metadata: [], items: [] }]);

    await expect(service.listSummary(createQuery(), ACCESS)).resolves.toEqual({
      month: '2026-08',
      items: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });
  });
});
