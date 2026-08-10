import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { HrRole } from '../auth/enums/hr-role.enum';
import { OperationAction } from '../operation-log/enums/operation-action.enum';
import { OperationTargetType } from '../operation-log/enums/operation-target-type.enum';
import { WorkLocation } from '../student/enums/student.enums';
import { AttendanceSource } from './enums/attendance-source.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { CheckInMode } from './enums/check-in-mode.enum';
import { LateLevel } from './enums/late-level.enum';
import { HrAttendanceCorrectionService } from './hr-attendance-correction.service';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const OWNER_HR_ID = '6a574ec45bd0f7b2a8b65b98';
const RECORD_ID = '6a574ec45bd0f7b2a8b65a10';
const ASSIGNMENT_ID = '6a574ec45bd0f7b2a8b65a11';
const NOW = new Date('2026-08-07T04:00:00.000Z');

function queryResult<T>(value: T) {
  return {
    lean: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(value),
    }),
  };
}

function businessDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function createService() {
  const attendanceRecordModel = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create:
      jest.fn<
        (
          payload: Record<string, unknown>,
        ) => Promise<{ toObject: () => Record<string, unknown> }>
      >(),
  };
  const accessService = {
    getAccessibleStudent: jest.fn().mockResolvedValue({
      id: STUDENT_ID,
      ownerHrId: OWNER_HR_ID,
      onboardingStartAt: new Date('2026-08-01T00:00:00+08:00'),
      onboardingEndAt: new Date('2026-08-31T00:00:00+08:00'),
    }),
  };
  const businessClock = {
    now: jest.fn().mockReturnValue(NOW),
    getBusinessDate: jest.fn((date: Date = NOW) => businessDate(date)),
  };
  const locationService = {
    findEffectiveLocation: jest.fn().mockResolvedValue({
      assignmentId: ASSIGNMENT_ID,
      studentId: STUDENT_ID,
      workLocation: WorkLocation.ShanghaiOffice,
      regionCode: 'shanghai',
      effectiveFrom: new Date('2026-08-01T00:00:00+08:00'),
      effectiveTo: null,
    }),
  };
  const calendarService = {
    isWorkday: jest.fn().mockResolvedValue({ isWorkday: true }),
  };
  const checkInPolicyService = {
    assertCheckInModeAllowed: jest.fn(),
  };
  const operationLogInputs: Record<string, unknown>[] = [];
  const operationLogService = {
    record: jest.fn((input: Record<string, unknown>): Promise<void> => {
      operationLogInputs.push(input);
      return Promise.resolve();
    }),
  };
  const service = new HrAttendanceCorrectionService(
    attendanceRecordModel as never,
    accessService as never,
    businessClock as never,
    locationService as never,
    calendarService as never,
    checkInPolicyService as never,
    operationLogService as never,
  );
  const access = { hrUserId: HR_ID, role: HrRole.Hr };

  return {
    service,
    attendanceRecordModel,
    accessService,
    businessClock,
    locationService,
    calendarService,
    checkInPolicyService,
    operationLogService,
    operationLogInputs,
    access,
  };
}

describe('HrAttendanceCorrectionService', () => {
  it('updates an existing record and preserves its original source and device fields', async () => {
    const {
      service,
      attendanceRecordModel,
      checkInPolicyService,
      operationLogService,
      operationLogInputs,
      access,
    } = createService();
    const existing = {
      _id: { toString: () => RECORD_ID },
      attendanceDate: '2026-08-05',
      status: AttendanceStatus.OnTime,
      source: AttendanceSource.CheckIn,
      originalStatus: null,
      correctionCount: 0,
      lateLevel: null,
      checkInAt: new Date('2026-08-05T01:00:00.000Z'),
      assignedWorkLocation: WorkLocation.ShanghaiOffice,
      checkInMode: CheckInMode.Offline,
      checkInLocation: WorkLocation.ShanghaiOffice,
      deviceIdHash: 'must-not-enter-operation-log',
      matchedOfficeNetworkId: { toString: () => ASSIGNMENT_ID },
      ipMatchSucceeded: true,
    };
    const updated = {
      ...existing,
      status: AttendanceStatus.Late,
      lateLevel: LateLevel.Normal,
      checkInAt: new Date('2026-08-05T02:10:00.000Z'),
      originalStatus: AttendanceStatus.OnTime,
      correctionCount: 1,
      correctedByHrId: { toString: () => HR_ID },
      correctedAt: NOW,
      correctionReason: '已核实实际签到时间',
    };
    attendanceRecordModel.findOne.mockReturnValue(queryResult(existing));
    attendanceRecordModel.findOneAndUpdate.mockReturnValue(
      queryResult(updated),
    );

    const response = await service.correctAttendance(
      STUDENT_ID,
      '2026-08-05',
      {
        status: AttendanceStatus.Late,
        reason: '已核实实际签到时间',
        checkInAt: '2026-08-05T02:10:00.000Z',
        checkInMode: CheckInMode.Offline,
      },
      access,
    );

    expect(checkInPolicyService.assertCheckInModeAllowed).toHaveBeenCalledWith(
      WorkLocation.ShanghaiOffice,
      CheckInMode.Offline,
    );
    expect(attendanceRecordModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update, options] = attendanceRecordModel.findOneAndUpdate
      .mock.calls[0] as unknown as [
      { _id: typeof existing._id },
      {
        $set: Record<string, unknown>;
        $inc: { correctionCount: number };
      },
      { new: boolean; runValidators: boolean },
    ];
    expect(filter).toEqual({ _id: existing._id });
    expect(update.$set).toEqual(
      expect.objectContaining({
        status: AttendanceStatus.Late,
        originalStatus: AttendanceStatus.OnTime,
        correctionReason: '已核实实际签到时间',
        leaveBatchId: null,
      }),
    );
    expect(update.$inc).toEqual({ correctionCount: 1 });
    expect(options).toEqual({ new: true, runValidators: true });
    expect(update.$set).not.toHaveProperty('source');
    expect(update.$set).not.toHaveProperty('deviceIdHash');
    expect(response).toMatchObject({
      message: '考勤记录更正成功',
      record: {
        source: AttendanceSource.CheckIn,
        correction: {
          originalStatus: AttendanceStatus.OnTime,
          count: 1,
        },
      },
    });
    expect(operationLogService.record).toHaveBeenCalledTimes(1);
    const [logInput] = operationLogInputs;
    expect(logInput).toMatchObject({
      operatorHrId: HR_ID,
      studentId: STUDENT_ID,
      targetType: OperationTargetType.AttendanceRecord,
      targetId: RECORD_ID,
      action: OperationAction.AttendanceRecordCorrected,
      changes: {
        attendanceDate: '2026-08-05',
        reason: '已核实实际签到时间',
        before: {
          status: AttendanceStatus.OnTime,
          source: AttendanceSource.CheckIn,
          correctionCount: 0,
        },
        after: {
          status: AttendanceStatus.Late,
          source: AttendanceSource.CheckIn,
          correctionCount: 1,
        },
      },
    });
    expect(JSON.stringify(logInput)).not.toMatch(
      /deviceIdHash|matchedOfficeNetworkId|ipMatchSucceeded/,
    );
  });

  it('creates a missing leave record as an HR correction', async () => {
    const {
      service,
      attendanceRecordModel,
      operationLogService,
      operationLogInputs,
      access,
    } = createService();
    attendanceRecordModel.findOne.mockReturnValue(queryResult(null));
    attendanceRecordModel.create.mockImplementation(
      (payload: Record<string, unknown>) =>
        Promise.resolve({
          toObject: (): Record<string, unknown> => ({
            _id: { toString: () => RECORD_ID },
            ...payload,
          }),
        }),
    );

    const response = await service.correctAttendance(
      STUDENT_ID,
      '2026-08-05',
      { status: AttendanceStatus.Leave, reason: '补录已批准请假' },
      access,
    );

    expect(attendanceRecordModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: AttendanceStatus.Leave,
        source: AttendanceSource.HrCorrection,
        originalStatus: null,
        correctionCount: 1,
        deviceIdHash: null,
        checkInAt: null,
      }),
    );
    expect(response.record).toMatchObject({
      status: AttendanceStatus.Leave,
      source: AttendanceSource.HrCorrection,
      correction: { originalStatus: null, count: 1 },
    });
    expect(operationLogService.record).toHaveBeenCalledTimes(1);
    const [logInput] = operationLogInputs;
    expect(logInput).toMatchObject({
      studentId: STUDENT_ID,
      targetType: OperationTargetType.AttendanceRecord,
      targetId: RECORD_ID,
      action: OperationAction.AttendanceRecordCorrected,
      changes: {
        attendanceDate: '2026-08-05',
        reason: '补录已批准请假',
        before: null,
        after: {
          status: AttendanceStatus.Leave,
          source: AttendanceSource.HrCorrection,
        },
      },
    });
  });

  it('rejects future dates before loading student data', async () => {
    const { service, accessService, operationLogService, access } =
      createService();

    await expect(
      service.correctAttendance(
        STUDENT_ID,
        '2026-08-08',
        { status: AttendanceStatus.Leave, reason: '未来请假' },
        access,
      ),
    ).rejects.toThrow('只能更正今天或过去日期的考勤');
    expect(accessService.getAccessibleStudent).not.toHaveBeenCalled();
    expect(operationLogService.record).not.toHaveBeenCalled();
  });

  it('stops when the HR cannot access the student', async () => {
    const { service, accessService, locationService, access } = createService();
    accessService.getAccessibleStudent.mockRejectedValue(
      new ForbiddenException('学生不存在'),
    );

    await expect(
      service.correctAttendance(
        STUDENT_ID,
        '2026-08-05',
        { status: AttendanceStatus.Leave, reason: '补录请假' },
        access,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(locationService.findEffectiveLocation).not.toHaveBeenCalled();
  });

  it('rejects dates outside the internship period', async () => {
    const { service, locationService, access } = createService();

    await expect(
      service.correctAttendance(
        STUDENT_ID,
        '2026-07-31',
        { status: AttendanceStatus.Absent, reason: '补录缺勤' },
        access,
      ),
    ).rejects.toThrow('更正日期不在学生实习日期范围内');
    expect(locationService.findEffectiveLocation).not.toHaveBeenCalled();
  });

  it('rejects dates without a location assignment or workday', async () => {
    const first = createService();
    first.locationService.findEffectiveLocation.mockResolvedValue(null);

    await expect(
      first.service.correctAttendance(
        STUDENT_ID,
        '2026-08-05',
        { status: AttendanceStatus.Absent, reason: '补录缺勤' },
        first.access,
      ),
    ).rejects.toThrow('该日期缺少有效工作地点安排');

    const second = createService();
    second.calendarService.isWorkday.mockResolvedValue({ isWorkday: false });
    await expect(
      second.service.correctAttendance(
        STUDENT_ID,
        '2026-08-05',
        { status: AttendanceStatus.Absent, reason: '补录缺勤' },
        second.access,
      ),
    ).rejects.toThrow('该日期不是应出勤工作日');
  });

  it.each([
    [
      {
        status: AttendanceStatus.OnTime,
        reason: '补录签到',
      },
      '该状态必须同时填写签到时间和签到方式',
    ],
    [
      {
        status: AttendanceStatus.Leave,
        reason: '补录请假',
        checkInAt: '2026-08-05T02:00:00.000Z',
      },
      '更正为请假时不能填写签到信息',
    ],
    [
      {
        status: AttendanceStatus.Absent,
        reason: '严重迟到',
        checkInAt: '2026-08-05T02:40:00.000Z',
        checkInMode: CheckInMode.Offline,
        lateLevel: LateLevel.Normal,
      },
      '缺勤签到记录只能使用严重迟到级别',
    ],
    [
      {
        status: AttendanceStatus.Late,
        reason: '错误日期',
        checkInAt: '2026-08-04T02:10:00.000Z',
        checkInMode: CheckInMode.Offline,
      },
      '签到时间必须属于所更正的考勤日期',
    ],
  ])('rejects inconsistent correction payload %#', async (dto, message) => {
    const { service, attendanceRecordModel, access } = createService();
    attendanceRecordModel.findOne.mockReturnValue(queryResult(null));

    await expect(
      service.correctAttendance(STUDENT_ID, '2026-08-05', dto, access),
    ).rejects.toThrow(message);
  });

  it('stores a severe late check-in as absent with a check-in timestamp', async () => {
    const { service, attendanceRecordModel, access } = createService();
    attendanceRecordModel.findOne.mockReturnValue(queryResult(null));
    attendanceRecordModel.create.mockImplementation(
      (payload: Record<string, unknown>) =>
        Promise.resolve({
          toObject: (): Record<string, unknown> => ({
            _id: { toString: () => RECORD_ID },
            ...payload,
          }),
        }),
    );

    await service.correctAttendance(
      STUDENT_ID,
      '2026-08-05',
      {
        status: AttendanceStatus.Absent,
        reason: '核实为严重迟到',
        checkInAt: '2026-08-05T02:40:00.000Z',
        checkInMode: CheckInMode.Offline,
      },
      access,
    );

    expect(attendanceRecordModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: AttendanceStatus.Absent,
        lateLevel: LateLevel.Severe,
        checkInAt: new Date('2026-08-05T02:40:00.000Z'),
      }),
    );
  });

  it('rejects a check-in mode forbidden by the assigned location', async () => {
    const { service, attendanceRecordModel, checkInPolicyService, access } =
      createService();
    attendanceRecordModel.findOne.mockReturnValue(queryResult(null));
    checkInPolicyService.assertCheckInModeAllowed.mockImplementation(() => {
      throw new BadRequestException('当前工作地点不允许所选签到方式');
    });

    await expect(
      service.correctAttendance(
        STUDENT_ID,
        '2026-08-05',
        {
          status: AttendanceStatus.OnTime,
          reason: '补录签到',
          checkInAt: '2026-08-05T01:00:00.000Z',
          checkInMode: CheckInMode.Offline,
        },
        access,
      ),
    ).rejects.toThrow('当前工作地点不允许所选签到方式');
  });
});
