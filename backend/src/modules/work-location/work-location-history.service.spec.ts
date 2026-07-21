import { BadRequestException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { WorkLocation } from '../student/enums/student.enums';
import type { WorkLocationAssignmentDocument } from './schemas/work-location-assignment.schema';
import { WorkLocationAssignmentSource } from './work-location-assignment-source.enum';
import { WorkLocationHistoryService } from './work-location-history.service';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const NOW = new Date('2026-09-01T00:00:00.000Z');

interface AssignmentModelMock {
  findOne: jest.Mock;
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
    ...overrides,
  } as unknown as WorkLocationAssignmentDocument;
}

function createService(model: AssignmentModelMock) {
  return new WorkLocationHistoryService(
    model as unknown as Model<WorkLocationAssignmentDocument>,
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
