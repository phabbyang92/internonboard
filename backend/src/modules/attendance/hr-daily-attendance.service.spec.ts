import type { Model, PipelineStage } from 'mongoose';
import { Types } from 'mongoose';
import { HrRole } from '../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { WorkLocation } from '../student/enums/student.enums';
import type { HrAttendanceAccessService } from './access/hr-attendance-access.service';
import type { AttendanceQueryPreparationService } from './attendance-query-preparation.service';
import type { ListHrDailyAttendanceQueryDto } from './dto/list-hr-daily-attendance-query.dto';
import { AttendanceSource } from './enums/attendance-source.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { CheckInMode } from './enums/check-in-mode.enum';
import { HrDailyAttendanceSort } from './enums/hr-attendance-sort.enum';
import { LateLevel } from './enums/late-level.enum';
import { HrDailyAttendanceService } from './hr-daily-attendance.service';
import type { AttendanceRecordDocument } from './schemas/attendance-record.schema';

const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const RECORD_ID = '6a574ec45bd0f7b2a8b65a09';
const ACCESS: HrAccessContext = { hrUserId: HR_ID, role: HrRole.Hr };

function createQuery(
  overrides: Partial<ListHrDailyAttendanceQueryDto> = {},
): ListHrDailyAttendanceQueryDto {
  return {
    date: '2026-08-07',
    page: 1,
    limit: 20,
    sortBy: HrDailyAttendanceSort.StudentNameAsc,
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
    prepareHrDaily: jest.fn().mockResolvedValue(undefined),
  };

  return {
    model,
    accessService,
    queryPreparationService,
    getPipeline: () => {
      if (!capturedPipeline) {
        throw new Error('Attendance aggregation pipeline was not generated');
      }

      return capturedPipeline;
    },
    service: new HrDailyAttendanceService(
      model as unknown as Model<AttendanceRecordDocument>,
      accessService as unknown as HrAttendanceAccessService,
      queryPreparationService as unknown as AttendanceQueryPreparationService,
    ),
  };
}

describe('HrDailyAttendanceService', () => {
  it('reconciles, scopes, filters and serializes a daily attendance page', async () => {
    const checkInAt = new Date('2026-08-07T01:55:00.000Z');
    const aggregateResult = [
      {
        summary: [
          {
            totalStudents: 4,
            checkedIn: 3,
            onTime: 1,
            late: 1,
            leave: 1,
            absent: 1,
          },
        ],
        metadata: [{ total: 4 }],
        items: [
          {
            _id: new Types.ObjectId(RECORD_ID),
            attendanceDate: '2026-08-07',
            status: AttendanceStatus.Late,
            lateLevel: LateLevel.Normal,
            source: AttendanceSource.CheckIn,
            checkInAt,
            assignedWorkLocation: WorkLocation.ShanghaiOffice,
            checkInMode: CheckInMode.Offline,
            checkInLocation: WorkLocation.ShanghaiOffice,
            studentId: new Types.ObjectId(STUDENT_ID),
            studentName: '测试学生',
            studentEmail: 'student@example.com',
            ownerHrId: new Types.ObjectId(HR_ID),
            ownerHrName: '上海 HR',
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
      status: AttendanceStatus.Late,
      workLocation: WorkLocation.ShanghaiOffice,
      checkInMode: CheckInMode.Offline,
      ownerHrId: HR_ID,
      sortBy: HrDailyAttendanceSort.CheckInAtAsc,
    });

    const result = await service.listDaily(query, ACCESS);

    expect(accessService.resolveAttendanceScope).toHaveBeenCalledWith(
      ACCESS,
      HR_ID,
    );
    expect(queryPreparationService.prepareHrDaily).toHaveBeenCalledWith(
      query.date,
      ACCESS,
      undefined,
      HR_ID,
    );
    expect(model.aggregate).toHaveBeenCalledTimes(1);

    const pipeline = getPipeline();
    expect(pipeline[0]).toEqual({
      $match: {
        attendanceDate: query.date,
        ownerHrId: new Types.ObjectId(HR_ID),
        status: AttendanceStatus.Late,
        assignedWorkLocation: WorkLocation.ShanghaiOffice,
        checkInMode: CheckInMode.Offline,
      },
    });
    const keywordStage = pipeline.find(
      (stage) => '$match' in stage && '$or' in stage.$match,
    );
    expect(keywordStage).toBeDefined();

    expect(result).toEqual({
      attendanceDate: query.date,
      summary: aggregateResult[0].summary[0],
      items: [
        {
          id: RECORD_ID,
          attendanceDate: query.date,
          status: AttendanceStatus.Late,
          lateLevel: LateLevel.Normal,
          source: AttendanceSource.CheckIn,
          checkInAt,
          assignedWorkLocation: WorkLocation.ShanghaiOffice,
          checkInMode: CheckInMode.Offline,
          checkInLocation: WorkLocation.ShanghaiOffice,
          correction: null,
          student: {
            id: STUDENT_ID,
            name: '测试学生',
            email: 'student@example.com',
            ownerHr: { id: HR_ID, name: '上海 HR' },
          },
        },
      ],
      pagination: { page: 1, limit: 20, total: 4, totalPages: 1 },
    });
  });

  it('uses check-in timestamps and final statuses for the daily counters', async () => {
    const { service, getPipeline } = createService([
      { summary: [], metadata: [], items: [] },
    ]);

    await service.listDaily(createQuery(), ACCESS);

    const pipeline = getPipeline();
    const facetStage = pipeline.find((stage) => '$facet' in stage);
    expect(facetStage).toBeDefined();

    if (!facetStage || !('$facet' in facetStage)) {
      throw new Error('Daily attendance facet was not generated');
    }

    const summaryGroup = facetStage.$facet.summary[0];
    expect(summaryGroup).toMatchObject({
      $group: {
        checkedIn: {
          $sum: { $cond: [{ $ne: ['$checkInAt', null] }, 1, 0] },
        },
        absent: {
          $sum: {
            $cond: [{ $eq: ['$status', AttendanceStatus.Absent] }, 1, 0],
          },
        },
      },
    });
  });

  it('queries and prepares all owners for an Admin without an owner filter', async () => {
    const adminAccess: HrAccessContext = {
      hrUserId: HR_ID,
      role: HrRole.Admin,
    };
    const { service, accessService, queryPreparationService, getPipeline } =
      createService([{ summary: [], metadata: [], items: [] }]);
    accessService.resolveAttendanceScope.mockResolvedValue({
      access: adminAccess,
      ownerHrId: null,
    });

    await service.listDaily(createQuery(), adminAccess);

    expect(accessService.resolveAttendanceScope).toHaveBeenCalledWith(
      adminAccess,
      undefined,
    );
    expect(queryPreparationService.prepareHrDaily).toHaveBeenCalledWith(
      '2026-08-07',
      adminAccess,
      undefined,
      null,
    );
    expect(getPipeline()[0]).toEqual({
      $match: { attendanceDate: '2026-08-07' },
    });
  });

  it('limits an Admin query and preparation to the selected owner', async () => {
    const adminAccess: HrAccessContext = {
      hrUserId: HR_ID,
      role: HrRole.Admin,
    };
    const ownerHrId = new Types.ObjectId(HR_ID);
    const { service, accessService, queryPreparationService, getPipeline } =
      createService([{ summary: [], metadata: [], items: [] }]);
    accessService.resolveAttendanceScope.mockResolvedValue({
      access: adminAccess,
      ownerHrId,
    });

    await service.listDaily(createQuery({ ownerHrId: HR_ID }), adminAccess);

    expect(queryPreparationService.prepareHrDaily).toHaveBeenCalledWith(
      '2026-08-07',
      adminAccess,
      undefined,
      HR_ID,
    );
    expect(getPipeline()[0]).toEqual({
      $match: {
        attendanceDate: '2026-08-07',
        ownerHrId,
      },
    });
  });

  it.each([
    [HrDailyAttendanceSort.StudentNameAsc, { _studentNameSort: 1, _id: 1 }],
    [
      HrDailyAttendanceSort.CheckInAtAsc,
      {
        _checkInMissing: 1,
        checkInAt: 1,
        _studentNameSort: 1,
        _id: 1,
      },
    ],
    [
      HrDailyAttendanceSort.CheckInAtDesc,
      {
        _checkInMissing: 1,
        checkInAt: -1,
        _studentNameSort: 1,
        _id: 1,
      },
    ],
  ])('applies the %s daily sort', async (sortBy, expectedSort) => {
    const { service, getPipeline } = createService([
      { summary: [], metadata: [], items: [] },
    ]);

    await service.listDaily(createQuery({ sortBy }), ACCESS);

    const facetStage = getPipeline().find((stage) => '$facet' in stage);
    if (!facetStage || !('$facet' in facetStage)) {
      throw new Error('Daily attendance facet was not generated');
    }

    expect(facetStage.$facet.items[0]).toEqual({ $sort: expectedSort });
  });

  it('paginates daily records without changing totals or summary counters', async () => {
    const { service, getPipeline } = createService([
      { summary: [], metadata: [], items: [] },
    ]);

    await service.listDaily(createQuery({ page: 3, limit: 10 }), ACCESS);

    const facetStage = getPipeline().find((stage) => '$facet' in stage);
    if (!facetStage || !('$facet' in facetStage)) {
      throw new Error('Daily attendance facet was not generated');
    }

    expect(facetStage.$facet.metadata).toEqual([{ $count: 'total' }]);
    expect(facetStage.$facet.summary[0]).toHaveProperty('$group');
    expect(facetStage.$facet.items.slice(0, 3)).toEqual([
      { $sort: { _studentNameSort: 1, _id: 1 } },
      { $skip: 20 },
      { $limit: 10 },
    ]);
  });

  it('returns stable zero values when the filtered day has no records', async () => {
    const { service } = createService([
      { summary: [], metadata: [], items: [] },
    ]);

    await expect(service.listDaily(createQuery(), ACCESS)).resolves.toEqual({
      attendanceDate: '2026-08-07',
      summary: {
        totalStudents: 0,
        checkedIn: 0,
        onTime: 0,
        late: 0,
        leave: 0,
        absent: 0,
      },
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
