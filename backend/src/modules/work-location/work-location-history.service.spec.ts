import { BadRequestException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { WorkLocation } from '../student/enums/student.enums';
import type { StudentDocument } from '../student/schemas/student.schema';
import type { WorkLocationAssignmentDocument } from './schemas/work-location-assignment.schema';
import { WorkLocationAssignmentSource } from './work-location-assignment-source.enum';
import { WorkLocationHistoryService } from './work-location-history.service';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const NOW = new Date('2026-09-01T00:00:00.000Z');

interface AssignmentModelMock {
  findOne: jest.Mock;
  find?: jest.Mock;
  create: jest.Mock;
}

function queryResult<T>(value: T) {
  return {
    sort: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(value),
    }),
  };
}

function createAssignment(
  overrides: Partial<WorkLocationAssignmentDocument> = {},
): WorkLocationAssignmentDocument {
  return {
    _id: new Types.ObjectId('6a574ec45bd0f7b2a8b65c11'),
    studentId: new Types.ObjectId(STUDENT_ID),
    workLocation: WorkLocation.BeijingOffice,
    effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
    effectiveTo: null,
    changedByHrId: new Types.ObjectId(HR_ID),
    source: WorkLocationAssignmentSource.Single,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    save: jest.fn().mockResolvedValue(undefined),
    deleteOne: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as WorkLocationAssignmentDocument;
}

function createService(
  model: AssignmentModelMock,
  studentModel = { updateOne: jest.fn() },
) {
  return new WorkLocationHistoryService(
    model as unknown as Model<WorkLocationAssignmentDocument>,
    studentModel as unknown as Model<StudentDocument>,
  );
}

function input(workLocation: string = WorkLocation.ShanghaiOffice) {
  return {
    studentId: STUDENT_ID,
    workLocation,
    onboardingStartAt: new Date('2026-08-01T00:00:00.000Z'),
    changedByHrId: HR_ID,
    source: WorkLocationAssignmentSource.Single,
  };
}

describe('WorkLocationHistoryService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates the first location from the original onboarding start time', async () => {
    const model: AssignmentModelMock = {
      findOne: jest.fn().mockReturnValue(queryResult(null)),
      create: jest.fn(),
    };
    const created = createAssignment({
      workLocation: WorkLocation.ShanghaiOffice,
    });
    model.create.mockResolvedValue(created);

    await createService(model).recordAssignment(input());

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workLocation: WorkLocation.ShanghaiOffice,
        effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
        effectiveTo: null,
      }),
    );
  });

  it('preserves a legacy location label while backfilling history', async () => {
    const model: AssignmentModelMock = {
      findOne: jest.fn().mockReturnValue(queryResult(null)),
      create: jest.fn(),
    };
    model.create.mockResolvedValue(
      createAssignment({ workLocation: '上海静安' }),
    );

    await createService(model).recordAssignment(input('上海静安'));

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ workLocation: '上海静安' }),
    );
  });

  it('updates a future plan in place without creating a zero-length record', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const futureAssignment = createAssignment({
      effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
      save,
    });
    const model: AssignmentModelMock = {
      findOne: jest.fn().mockReturnValue(queryResult(futureAssignment)),
      create: jest.fn(),
    };

    await createService(model).recordAssignment({
      ...input(WorkLocation.Online),
      onboardingStartAt: new Date('2026-11-01T00:00:00.000Z'),
    });

    expect(futureAssignment.workLocation).toBe(WorkLocation.Online);
    expect(futureAssignment.effectiveFrom).toEqual(
      new Date('2026-11-01T00:00:00.000Z'),
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('closes location A and starts location B at the change time', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const current = createAssignment({ save });
    const replacement = createAssignment({
      workLocation: WorkLocation.ShanghaiOffice,
      effectiveFrom: NOW,
    });
    const model: AssignmentModelMock = {
      findOne: jest.fn().mockReturnValue(queryResult(current)),
      find: jest.fn().mockReturnValue(queryResult([current])),
      create: jest.fn().mockResolvedValue(replacement),
    };

    await createService(model).recordAssignment(input());

    expect(current.effectiveTo).toEqual(NOW);
    expect(save).toHaveBeenCalledTimes(1);
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workLocation: WorkLocation.ShanghaiOffice,
        effectiveFrom: NOW,
      }),
    );
  });

  it('changes location at the HR-provided effective date', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const current = createAssignment({ save });
    const effectiveFrom = new Date('2026-08-15T00:00:00.000Z');
    const replacement = createAssignment({
      workLocation: WorkLocation.Online,
      effectiveFrom,
      source: WorkLocationAssignmentSource.Change,
    });
    const model: AssignmentModelMock = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnValue(queryResult([current])),
      create: jest.fn().mockResolvedValue(replacement),
    };

    await createService(model).changeLocation({
      studentId: STUDENT_ID,
      workLocation: WorkLocation.Online,
      effectiveFrom,
      changedByHrId: HR_ID,
    });

    expect(current.effectiveTo).toEqual(effectiveFrom);
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workLocation: WorkLocation.Online,
        effectiveFrom,
        source: WorkLocationAssignmentSource.Change,
      }),
    );
  });

  it('activates only the latest due location for each student', async () => {
    const latestDue = createAssignment({
      workLocation: WorkLocation.Online,
      effectiveFrom: new Date('2026-08-15T00:00:00.000Z'),
    });
    const olderDue = createAssignment({
      workLocation: WorkLocation.ShanghaiOffice,
      effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
    });
    const model: AssignmentModelMock = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnValue(queryResult([latestDue, olderDue])),
      create: jest.fn(),
    };
    const studentModel = {
      updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      }),
    };

    const result = await createService(
      model,
      studentModel,
    ).activateDueAssignments(new Date('2026-09-01T00:00:00.000Z'));

    expect(studentModel.updateOne).toHaveBeenCalledTimes(1);
    expect(studentModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: latestDue.studentId }),
      { $set: { workLocation: WorkLocation.Online } },
    );
    expect(result).toEqual({ modifiedCount: 1 });
  });

  it('updates a non-first segment and rebuilds adjacent date boundaries', async () => {
    const first = createAssignment({
      _id: new Types.ObjectId('6a574ec45bd0f7b2a8b65c11'),
      workLocation: WorkLocation.BeijingOffice,
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      effectiveTo: new Date('2026-08-01T00:00:00.000Z'),
    });
    const middle = createAssignment({
      _id: new Types.ObjectId('6a574ec45bd0f7b2a8b65c12'),
      workLocation: WorkLocation.ShanghaiOffice,
      effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
      effectiveTo: new Date('2026-09-01T00:00:00.000Z'),
    });
    const final = createAssignment({
      _id: new Types.ObjectId('6a574ec45bd0f7b2a8b65c13'),
      workLocation: WorkLocation.ShenzhenOffice,
      effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      effectiveTo: null,
    });
    const model: AssignmentModelMock = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnValue(queryResult([first, middle, final])),
      create: jest.fn(),
    };
    const changedDate = new Date('2026-08-05T00:00:00.000Z');

    const result = await createService(model).updateAssignment({
      studentId: STUDENT_ID,
      assignmentId: middle._id.toString(),
      workLocation: WorkLocation.Online,
      effectiveFrom: changedDate,
      changedByHrId: HR_ID,
    });

    expect(result.before.workLocation).toBe(WorkLocation.ShanghaiOffice);
    expect(result.assignment.workLocation).toBe(WorkLocation.Online);
    expect(middle.effectiveFrom).toEqual(changedDate);
    expect(first.effectiveTo).toEqual(changedDate);
    expect(middle.effectiveTo).toEqual(final.effectiveFrom);
  });

  it('does not allow the first work-location segment to be edited', async () => {
    const first = createAssignment();
    const model: AssignmentModelMock = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnValue(queryResult([first])),
      create: jest.fn(),
    };

    await expect(
      createService(model).updateAssignment({
        studentId: STUDENT_ID,
        assignmentId: first._id.toString(),
        workLocation: WorkLocation.Online,
        effectiveFrom: new Date('2026-08-02T00:00:00.000Z'),
        changedByHrId: HR_ID,
      }),
    ).rejects.toThrow('第一段工作地点记录不能修改');
  });

  it('removes the final segment and reopens the previous segment', async () => {
    const firstSave = jest.fn().mockResolvedValue(undefined);
    const finalDelete = jest.fn().mockResolvedValue(undefined);
    const first = createAssignment({
      _id: new Types.ObjectId('6a574ec45bd0f7b2a8b65c11'),
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      effectiveTo: new Date('2026-08-01T00:00:00.000Z'),
      save: firstSave,
    });
    const final = createAssignment({
      _id: new Types.ObjectId('6a574ec45bd0f7b2a8b65c12'),
      workLocation: WorkLocation.Online,
      effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
      effectiveTo: null,
      deleteOne: finalDelete,
    });
    const model: AssignmentModelMock = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnValue(queryResult([first, final])),
      create: jest.fn(),
    };

    await createService(model).removeAssignment({
      studentId: STUDENT_ID,
      assignmentId: final._id.toString(),
    });

    expect(finalDelete).toHaveBeenCalledTimes(1);
    expect(first.effectiveTo).toBeNull();
    expect(firstSave).toHaveBeenCalled();
  });

  it('merges matching locations after cancelling the segment between them', async () => {
    const middleDelete = jest.fn().mockResolvedValue(undefined);
    const finalDelete = jest.fn().mockResolvedValue(undefined);
    const first = createAssignment({
      _id: new Types.ObjectId('6a574ec45bd0f7b2a8b65c11'),
      workLocation: WorkLocation.BeijingOffice,
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      effectiveTo: new Date('2026-08-01T00:00:00.000Z'),
    });
    const middle = createAssignment({
      _id: new Types.ObjectId('6a574ec45bd0f7b2a8b65c12'),
      workLocation: WorkLocation.Online,
      effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
      effectiveTo: new Date('2026-09-01T00:00:00.000Z'),
      deleteOne: middleDelete,
    });
    const final = createAssignment({
      _id: new Types.ObjectId('6a574ec45bd0f7b2a8b65c13'),
      workLocation: WorkLocation.BeijingOffice,
      effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      effectiveTo: null,
      deleteOne: finalDelete,
    });
    const model: AssignmentModelMock = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnValue(queryResult([first, middle, final])),
      create: jest.fn(),
    };

    await createService(model).removeAssignment({
      studentId: STUDENT_ID,
      assignmentId: middle._id.toString(),
    });

    expect(middleDelete).toHaveBeenCalledTimes(1);
    expect(finalDelete).toHaveBeenCalledTimes(1);
    expect(first.effectiveTo).toBeNull();
  });

  it('inserts a location before the earliest existing assignment', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const current = createAssignment({ save });
    const effectiveFrom = new Date('2026-07-01T00:00:00.000Z');
    const earlier = createAssignment({
      workLocation: WorkLocation.Online,
      effectiveFrom,
      effectiveTo: current.effectiveFrom,
    });
    const model: AssignmentModelMock = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnValue(queryResult([current])),
      create: jest.fn().mockResolvedValue(earlier),
    };

    await createService(model).changeLocation({
      studentId: STUDENT_ID,
      workLocation: WorkLocation.Online,
      effectiveFrom,
      changedByHrId: HR_ID,
    });

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        effectiveFrom,
        effectiveTo: current.effectiveFrom,
      }),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('does not duplicate the current location when it has not changed', async () => {
    const current = createAssignment({
      workLocation: WorkLocation.ShanghaiOffice,
    });
    const model: AssignmentModelMock = {
      findOne: jest.fn().mockReturnValue(queryResult(current)),
      create: jest.fn(),
    };

    const result = await createService(model).recordAssignment(input());

    expect(result.workLocation).toBe(WorkLocation.ShanghaiOffice);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('closes a cancelled future assignment at its start time', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const futureStart = new Date('2026-10-01T00:00:00.000Z');
    const futureAssignment = createAssignment({
      effectiveFrom: futureStart,
      save,
    });
    const model: AssignmentModelMock = {
      findOne: jest.fn().mockReturnValue(queryResult(futureAssignment)),
      create: jest.fn(),
    };

    await createService(model).closeCurrentAssignment(STUDENT_ID, NOW);

    expect(futureAssignment.effectiveTo).toEqual(futureStart);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid student or HR IDs', async () => {
    const model: AssignmentModelMock = {
      findOne: jest.fn(),
      create: jest.fn(),
    };

    await expect(
      createService(model).recordAssignment({
        ...input(),
        changedByHrId: 'invalid-id',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
