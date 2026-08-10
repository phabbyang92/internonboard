import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { HrRole } from '../../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../../auth/interfaces/hr-access-context.interface';
import type { HrUserDocument } from '../../auth/schemas/hr-user.schema';
import type { StudentService } from '../../student/student.service';
import { HrAttendanceAccessService } from './hr-attendance-access.service';

const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const OTHER_HR_ID = '6a574ec45bd0f7b2a8b65b98';
const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';

function createService(currentRole: HrRole | null) {
  const exec = jest
    .fn()
    .mockResolvedValue(currentRole ? { role: currentRole } : null);
  const lean = jest.fn().mockReturnValue({ exec });
  const select = jest.fn().mockReturnValue({ lean });
  const hrUserModel = {
    findById: jest.fn().mockReturnValue({ select }),
  };
  const studentService = {
    findOneByIdForHr: jest.fn(),
  };

  return {
    hrUserModel,
    studentService,
    service: new HrAttendanceAccessService(
      hrUserModel as unknown as Model<HrUserDocument>,
      studentService as unknown as StudentService,
    ),
  };
}

describe('HrAttendanceAccessService', () => {
  const regularAccess: HrAccessContext = {
    hrUserId: HR_ID,
    role: HrRole.Hr,
  };

  it('always scopes a regular HR to their own attendance records', async () => {
    const { service } = createService(HrRole.Hr);

    const filter = await service.scopeAttendanceRecordFilter(
      { attendanceDate: '2026-08-07' },
      regularAccess,
    );

    expect(filter).toEqual({
      attendanceDate: '2026-08-07',
      ownerHrId: new Types.ObjectId(HR_ID),
    });
  });

  it('uses the current database role instead of a stale Admin login role', async () => {
    const { service } = createService(HrRole.Hr);

    const filter = await service.scopeAttendanceRecordFilter(
      {},
      { hrUserId: HR_ID, role: HrRole.Admin },
    );

    expect(filter.ownerHrId).toEqual(new Types.ObjectId(HR_ID));
  });

  it('allows a regular HR to explicitly request only their own owner ID', async () => {
    const { service } = createService(HrRole.Hr);

    await expect(
      service.scopeAttendanceRecordFilter({}, regularAccess, HR_ID),
    ).resolves.toEqual({ ownerHrId: new Types.ObjectId(HR_ID) });
  });

  it('rejects a regular HR owner filter for another HR', async () => {
    const { service } = createService(HrRole.Hr);

    await expect(
      service.scopeAttendanceRecordFilter({}, regularAccess, OTHER_HR_ID),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows an Admin HR to query all records or one requested owner', async () => {
    const { service } = createService(HrRole.Admin);

    await expect(
      service.scopeAttendanceRecordFilter(
        { ownerHrId: new Types.ObjectId(OTHER_HR_ID) },
        regularAccess,
      ),
    ).resolves.toEqual({});
    await expect(
      service.scopeAttendanceRecordFilter({}, regularAccess, OTHER_HR_ID),
    ).resolves.toEqual({ ownerHrId: new Types.ObjectId(OTHER_HR_ID) });
  });

  it('rejects invalid HR identifiers', async () => {
    const { service } = createService(HrRole.Admin);

    await expect(
      service.scopeAttendanceRecordFilter(
        {},
        { hrUserId: 'invalid-id', role: HrRole.Admin },
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.scopeAttendanceRecordFilter({}, regularAccess, 'invalid-id'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an HR account that no longer exists', async () => {
    const { service } = createService(null);

    await expect(
      service.scopeAttendanceRecordFilter({}, regularAccess),
    ).rejects.toThrow(ForbiddenException);
  });

  it('loads student details through the current ownership scope', async () => {
    const { service, studentService } = createService(HrRole.Hr);
    const student = { id: STUDENT_ID, name: '测试学生' };
    studentService.findOneByIdForHr.mockResolvedValue(student);

    await expect(
      service.getAccessibleStudent(STUDENT_ID, regularAccess),
    ).resolves.toBe(student);
    expect(studentService.findOneByIdForHr).toHaveBeenCalledWith(STUDENT_ID, {
      hrUserId: HR_ID,
      role: HrRole.Hr,
    });
  });

  it('does not translate a hidden or missing student into a distinguishable error', async () => {
    const { service, studentService } = createService(HrRole.Hr);
    studentService.findOneByIdForHr.mockRejectedValue(
      new NotFoundException('学生不存在'),
    );

    await expect(
      service.getAccessibleStudent(STUDENT_ID, regularAccess),
    ).rejects.toThrow(NotFoundException);
  });
});
