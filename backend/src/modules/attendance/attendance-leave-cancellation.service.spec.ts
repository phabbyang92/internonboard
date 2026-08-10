import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { BusinessClockService } from '../../common/time/business-clock.service';
import { AttendanceLeaveCancellationService } from './attendance-leave-cancellation.service';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import { AttendanceSource } from './enums/attendance-source.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import type { AttendanceRecordDocument } from './schemas/attendance-record.schema';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const RECORD_ID = new Types.ObjectId('6a574ec45bd0f7b2a8b65c31');
const NOW = new Date('2026-08-06T02:00:00.000Z');

function leaveRecord(overrides: Record<string, unknown> = {}) {
  return {
    _id: RECORD_ID,
    status: AttendanceStatus.Leave,
    source: AttendanceSource.LeaveRegistration,
    leaveBatchId: 'leave-batch-id',
    ...overrides,
  };
}

function createService(record: Record<string, unknown> | null = leaveRecord()) {
  const findExec = jest.fn().mockResolvedValue(record);
  const select = jest.fn().mockReturnValue({
    lean: () => ({ exec: findExec }),
  });
  const findOne = jest.fn(() => ({ select }));
  const deleteExec = jest.fn().mockResolvedValue({ deletedCount: 1 });
  const deleteOne = jest.fn(() => ({
    exec: deleteExec,
  }));
  const model = { findOne, deleteOne };
  const clock = {
    now: jest.fn().mockReturnValue(NOW),
    getBusinessDate: jest.fn().mockReturnValue('2026-08-06'),
  };

  return {
    findOne,
    findExec,
    deleteOne,
    deleteExec,
    service: new AttendanceLeaveCancellationService(
      model as unknown as Model<AttendanceRecordDocument>,
      clock as unknown as BusinessClockService,
    ),
  };
}

describe('AttendanceLeaveCancellationService', () => {
  it('deletes a future leave submitted by the authenticated student', async () => {
    const { service, findOne, deleteOne } = createService();

    const result = await service.cancel(STUDENT_ID, '2026-08-07');

    expect(result).toEqual({
      attendanceDate: '2026-08-07',
      leaveBatchId: 'leave-batch-id',
      cancelledAt: NOW,
    });
    expect(findOne).toHaveBeenCalledTimes(1);
    const findFilter = findOne.mock.calls[0][0];
    expect(findFilter.attendanceDate).toBe('2026-08-07');
    expect(String(findFilter.studentId)).toBe(STUDENT_ID);

    expect(deleteOne).toHaveBeenCalledTimes(1);
    const deleteFilter = deleteOne.mock.calls[0][0];
    expect(deleteFilter).toMatchObject({
      _id: RECORD_ID,
      attendanceDate: '2026-08-07',
      status: AttendanceStatus.Leave,
      source: AttendanceSource.LeaveRegistration,
    });
    expect(String(deleteFilter.studentId)).toBe(STUDENT_ID);
  });

  it.each(['2026-08-06', '2026-08-05'])(
    'rejects a leave date that is not later than today: %s',
    async (attendanceDate) => {
      const { service, findOne } = createService();

      await expect(
        service.cancel(STUDENT_ID, attendanceDate),
      ).rejects.toMatchObject({
        response: {
          code: AttendanceErrorCode.LeaveCancellationDateNotFuture,
        },
      });
      expect(findOne).not.toHaveBeenCalled();
    },
  );

  it.each(['2026/08/07', '2026-02-30'])(
    'rejects an invalid leave date: %s',
    async (attendanceDate) => {
      const { service, findOne } = createService();

      await expect(
        service.cancel(STUDENT_ID, attendanceDate),
      ).rejects.toMatchObject({
        response: { code: AttendanceErrorCode.InvalidLeaveDate },
      });
      expect(findOne).not.toHaveBeenCalled();
    },
  );

  it('returns not found when the logged-in student has no record on that date', async () => {
    const { service, deleteOne } = createService(null);

    await expect(
      service.cancel(STUDENT_ID, '2026-08-07'),
    ).rejects.toMatchObject({
      response: { code: AttendanceErrorCode.LeaveRecordNotFound },
    });
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it.each([
    {
      status: AttendanceStatus.OnTime,
      source: AttendanceSource.CheckIn,
    },
    {
      status: AttendanceStatus.Absent,
      source: AttendanceSource.AbsenceScheduler,
    },
    {
      status: AttendanceStatus.Leave,
      source: AttendanceSource.AbsenceScheduler,
    },
  ])('does not delete a non-student-leave record: %o', async (overrides) => {
    const { service, deleteOne } = createService(leaveRecord(overrides));

    await expect(
      service.cancel(STUDENT_ID, '2026-08-07'),
    ).rejects.toMatchObject({
      response: { code: AttendanceErrorCode.LeaveNotCancellable },
    });
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('returns not found when another request already removed the record', async () => {
    const { service, deleteExec } = createService();
    deleteExec.mockResolvedValueOnce({ deletedCount: 0 });

    await expect(
      service.cancel(STUDENT_ID, '2026-08-07'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an invalid student ID before reading MongoDB', async () => {
    const { service, findOne } = createService();

    await expect(service.cancel('invalid', '2026-08-07')).rejects.toThrow(
      BadRequestException,
    );
    expect(findOne).not.toHaveBeenCalled();
  });

  it('uses a conflict response for records the student is not allowed to cancel', async () => {
    const { service } = createService(
      leaveRecord({ source: AttendanceSource.CheckIn }),
    );

    await expect(
      service.cancel(STUDENT_ID, '2026-08-07'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
