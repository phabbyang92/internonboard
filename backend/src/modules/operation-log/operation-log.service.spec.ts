import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { OperationAction } from './enums/operation-action.enum';
import { OperationTargetType } from './enums/operation-target-type.enum';
import { OperationLogService } from './operation-log.service';
import type { OperationLogDocument } from './schemas/operation-log.schema';

const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const CALENDAR_ID = '6a574ec45bd0f7b2a8b65c41';
const LOG_ID = '6a574ec45bd0f7b2a8b65c51';

function createListQuery(value: unknown) {
  const query = {
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    lean: jest.fn(),
    exec: jest.fn().mockResolvedValue(value),
  };
  query.sort.mockReturnValue(query);
  query.skip.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.lean.mockReturnValue(query);
  return query;
}

function createService() {
  const model = {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  return {
    model,
    service: new OperationLogService(
      model as unknown as Model<OperationLogDocument>,
    ),
  };
}

describe('OperationLogService', () => {
  it('keeps existing student log calls backward compatible', async () => {
    const { service, model } = createService();
    model.create.mockResolvedValue({
      _id: new Types.ObjectId(LOG_ID),
      operatorHrId: new Types.ObjectId(HR_ID),
      studentId: new Types.ObjectId(STUDENT_ID),
      targetType: OperationTargetType.Student,
      targetId: new Types.ObjectId(STUDENT_ID),
      action: OperationAction.StudentProfileUpdated,
      changes: null,
      createdAt: new Date('2026-08-06T00:00:00.000Z'),
    });

    const result = await service.record({
      operatorHrId: HR_ID,
      studentId: STUDENT_ID,
      action: OperationAction.StudentProfileUpdated,
    });

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: new Types.ObjectId(STUDENT_ID),
        targetType: OperationTargetType.Student,
        targetId: new Types.ObjectId(STUDENT_ID),
      }),
    );
    expect(result.targetId).toBe(STUDENT_ID);
  });

  it('records a calendar target without requiring a student ID', async () => {
    const { service, model } = createService();
    model.create.mockResolvedValue({
      _id: new Types.ObjectId(LOG_ID),
      operatorHrId: new Types.ObjectId(HR_ID),
      studentId: null,
      targetType: OperationTargetType.AttendanceCalendar,
      targetId: new Types.ObjectId(CALENDAR_ID),
      action: OperationAction.AttendanceCalendarCreated,
      changes: { name: '临时假期' },
      createdAt: new Date('2026-08-06T00:00:00.000Z'),
    });

    const result = await service.record({
      operatorHrId: HR_ID,
      targetType: OperationTargetType.AttendanceCalendar,
      targetId: CALENDAR_ID,
      action: OperationAction.AttendanceCalendarCreated,
      changes: { name: '临时假期' },
    });

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: null,
        targetType: OperationTargetType.AttendanceCalendar,
        targetId: new Types.ObjectId(CALENDAR_ID),
      }),
    );
    expect(result.studentId).toBeNull();
  });

  it('returns legacy student logs that do not have target fields', async () => {
    const { service, model } = createService();
    model.find.mockReturnValue(
      createListQuery([
        {
          _id: new Types.ObjectId(LOG_ID),
          operatorHrId: new Types.ObjectId(HR_ID),
          studentId: new Types.ObjectId(STUDENT_ID),
          action: OperationAction.StudentCreated,
          changes: null,
          createdAt: new Date('2026-08-06T00:00:00.000Z'),
        },
      ]),
    );
    model.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });

    const result = await service.findByStudentId(STUDENT_ID, {});

    expect(result.items[0]).toMatchObject({
      targetType: OperationTargetType.Student,
      targetId: STUDENT_ID,
    });
  });
});
