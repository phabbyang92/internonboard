import { NotFoundException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { HrRole } from '../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import type { HrUserDocument } from '../auth/schemas/hr-user.schema';
import type { HrAttendanceAccessService } from './access/hr-attendance-access.service';
import type { AttendanceQueryPreparationService } from './attendance-query-preparation.service';
import { AttendanceSource } from './enums/attendance-source.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { CheckInMode } from './enums/check-in-mode.enum';
import { LateLevel } from './enums/late-level.enum';
import { HrStudentAttendanceService } from './hr-student-attendance.service';
import type { AttendanceRecordDocument } from './schemas/attendance-record.schema';

const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const CORRECTING_HR_ID = '6a574ec45bd0f7b2a8b65b98';
const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const ACCESS: HrAccessContext = { hrUserId: HR_ID, role: HrRole.Hr };

function makeRecord(
  id: string,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return {
    _id: new Types.ObjectId(id),
    attendanceDate: '2026-08-01',
    status: AttendanceStatus.OnTime,
    lateLevel: null,
    source: AttendanceSource.CheckIn,
    checkInAt: new Date('2026-08-01T01:00:00.000Z'),
    assignedWorkLocation: '线上',
    checkInMode: CheckInMode.Online,
    checkInLocation: '线上',
    ...overrides,
  };
}

function createService(records: Record<string, unknown>[] = []) {
  const attendanceExec = jest.fn().mockResolvedValue(records);
  const attendanceLean = jest.fn().mockReturnValue({ exec: attendanceExec });
  const sort = jest.fn().mockReturnValue({ lean: attendanceLean });
  const find = jest.fn().mockReturnValue({ sort });
  const attendanceRecordModel = { find };

  const ownerExec = jest.fn().mockResolvedValue({ name: '上海 HR' });
  const ownerLean = jest.fn().mockReturnValue({ exec: ownerExec });
  const ownerSelect = jest.fn().mockReturnValue({ lean: ownerLean });
  const hrUserModel = {
    findById: jest.fn().mockReturnValue({ select: ownerSelect }),
  };

  const student = {
    id: STUDENT_ID,
    ownerHrId: HR_ID,
    name: '测试学生',
    email: 'student@example.com',
    phone: '13800000000',
    onboardingStartAt: new Date('2026-07-01T00:00:00.000Z'),
    onboardingEndAt: new Date('2026-09-30T00:00:00.000Z'),
    workLocation: '上海办公室 - 会德丰',
  };
  const accessService = {
    getAccessibleStudent: jest.fn().mockResolvedValue(student),
  };
  const queryPreparationService = {
    prepareStudentMonth: jest.fn().mockResolvedValue(undefined),
  };

  return {
    attendanceRecordModel,
    hrUserModel,
    accessService,
    queryPreparationService,
    student,
    service: new HrStudentAttendanceService(
      attendanceRecordModel as unknown as Model<AttendanceRecordDocument>,
      hrUserModel as unknown as Model<HrUserDocument>,
      accessService as unknown as HrAttendanceAccessService,
      queryPreparationService as unknown as AttendanceQueryPreparationService,
    ),
  };
}

describe('HrStudentAttendanceService', () => {
  it('checks access, reconciles only the target student and returns monthly detail', async () => {
    const latestCheckInAt = new Date('2026-08-05T02:45:00.000Z');
    const correctedAt = new Date('2026-08-06T03:00:00.000Z');
    const records = [
      makeRecord('6a574ec45bd0f7b2a8b65a11', {}),
      makeRecord('6a574ec45bd0f7b2a8b65a12', {
        attendanceDate: '2026-08-02',
        status: AttendanceStatus.Late,
        lateLevel: LateLevel.Normal,
        checkInAt: new Date('2026-08-02T02:05:00.000Z'),
        assignedWorkLocation: '上海办公室 - 会德丰',
        checkInMode: CheckInMode.Offline,
        checkInLocation: '上海办公室 - 会德丰',
      }),
      makeRecord('6a574ec45bd0f7b2a8b65a13', {
        attendanceDate: '2026-08-03',
        status: AttendanceStatus.Leave,
        source: AttendanceSource.HrCorrection,
        checkInAt: null,
        checkInMode: null,
        checkInLocation: null,
        correctedByHrId: new Types.ObjectId(CORRECTING_HR_ID),
        correctedAt,
        correctionReason: '已核实请假',
      }),
      makeRecord('6a574ec45bd0f7b2a8b65a14', {
        attendanceDate: '2026-08-04',
        status: AttendanceStatus.Absent,
        source: AttendanceSource.AbsenceScheduler,
        checkInAt: null,
        checkInMode: null,
        checkInLocation: null,
      }),
      makeRecord('6a574ec45bd0f7b2a8b65a15', {
        attendanceDate: '2026-08-05',
        status: AttendanceStatus.Absent,
        lateLevel: LateLevel.Severe,
        checkInAt: latestCheckInAt,
        assignedWorkLocation: '上海办公室 - 会德丰',
        checkInMode: CheckInMode.Offline,
        checkInLocation: '上海办公室 - 会德丰',
      }),
    ];
    const {
      service,
      attendanceRecordModel,
      hrUserModel,
      accessService,
      queryPreparationService,
      student,
    } = createService(records);

    const result = await service.getStudentAttendance(
      STUDENT_ID,
      { month: '2026-08' },
      ACCESS,
    );

    expect(accessService.getAccessibleStudent).toHaveBeenCalledWith(
      STUDENT_ID,
      ACCESS,
    );
    expect(queryPreparationService.prepareStudentMonth).toHaveBeenCalledWith(
      STUDENT_ID,
      '2026-08',
    );
    expect(attendanceRecordModel.find).toHaveBeenCalledWith({
      studentId: new Types.ObjectId(STUDENT_ID),
      attendanceDate: { $gte: '2026-08-01', $lt: '2026-09-01' },
    });
    const findResult = attendanceRecordModel.find.mock.results[0]?.value as {
      sort: jest.Mock;
    };
    expect(findResult.sort).toHaveBeenCalledWith({
      attendanceDate: 1,
      _id: 1,
    });
    expect(hrUserModel.findById).toHaveBeenCalledWith(HR_ID);

    expect(result.month).toBe('2026-08');
    expect(result.student).toEqual({
      id: STUDENT_ID,
      name: student.name,
      email: student.email,
      ownerHr: { id: HR_ID, name: '上海 HR' },
      phone: student.phone,
      onboardingStartAt: student.onboardingStartAt,
      onboardingEndAt: student.onboardingEndAt,
      currentWorkLocation: student.workLocation,
    });
    expect(result.summary).toEqual({
      totalAttendanceDays: 2,
      late: { count: 1, dates: ['2026-08-02'] },
      leave: { count: 1, dates: ['2026-08-03'] },
      absent: {
        count: 2,
        dates: ['2026-08-04', '2026-08-05'],
      },
      onlineAttendanceDays: 1,
      offlineAttendanceDays: 1,
      latestCheckIn: {
        attendanceDate: '2026-08-05',
        checkInAt: latestCheckInAt,
        assignedWorkLocation: '上海办公室 - 会德丰',
        checkInMode: CheckInMode.Offline,
        checkInLocation: '上海办公室 - 会德丰',
      },
    });
    expect(result.items).toHaveLength(5);
    expect(result.items[2]?.correction).toEqual({
      correctedByHrId: CORRECTING_HR_ID,
      correctedAt,
      reason: '已核实请假',
      originalStatus: null,
      count: 1,
    });
  });

  it('returns an empty monthly summary when the student has no records', async () => {
    const { service } = createService();

    const result = await service.getStudentAttendance(
      STUDENT_ID,
      { month: '2026-12' },
      ACCESS,
    );

    expect(result.summary).toEqual({
      totalAttendanceDays: 0,
      late: { count: 0, dates: [] },
      leave: { count: 0, dates: [] },
      absent: { count: 0, dates: [] },
      onlineAttendanceDays: 0,
      offlineAttendanceDays: 0,
      latestCheckIn: null,
    });
    expect(result.items).toEqual([]);
  });

  it('does not query or reconcile attendance when the student is inaccessible', async () => {
    const {
      service,
      attendanceRecordModel,
      accessService,
      queryPreparationService,
    } = createService();
    accessService.getAccessibleStudent.mockRejectedValue(
      new NotFoundException('学生不存在'),
    );

    await expect(
      service.getStudentAttendance(STUDENT_ID, { month: '2026-08' }, ACCESS),
    ).rejects.toThrow(NotFoundException);
    expect(queryPreparationService.prepareStudentMonth).not.toHaveBeenCalled();
    expect(attendanceRecordModel.find).not.toHaveBeenCalled();
  });

  it('uses a safe owner label for legacy students without an owner HR', async () => {
    const { service, student, hrUserModel } = createService();
    student.ownerHrId = null as unknown as string;

    const result = await service.getStudentAttendance(
      STUDENT_ID,
      { month: '2026-08' },
      ACCESS,
    );

    expect(result.student.ownerHr).toEqual({ id: '', name: '未知 HR' });
    expect(hrUserModel.findById).not.toHaveBeenCalled();
  });
});
