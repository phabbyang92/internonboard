import { BadRequestException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { BusinessClockService } from '../../common/time/business-clock.service';
import { WorkLocation } from '../student/enums/student.enums';
import type { WorkLocationAssignmentDocument } from '../work-location/schemas/work-location-assignment.schema';
import type { RegionAccessService } from './access/region-access.service';
import { AttendanceLocationService } from './attendance-location.service';
import { RegionCode } from './enums/region-code.enum';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const ASSIGNMENT_ID = '6a574ec45bd0f7b2a8b65c20';

function createService(
  assignment: Record<string, unknown> | null = null,
  regionCode: RegionCode = RegionCode.Shanghai,
) {
  const exec = jest.fn().mockResolvedValue(assignment);
  const lean = jest.fn().mockReturnValue({ exec });
  const sort = jest.fn().mockReturnValue({ lean });
  const model = {
    findOne: jest.fn().mockReturnValue({ sort }),
  };
  const clock = {
    getBusinessDate: jest.fn().mockReturnValue('2026-08-05'),
  };
  const regionAccess = {
    getRegionForWorkLocation: jest.fn().mockReturnValue(regionCode),
  };

  return {
    model,
    clock,
    regionAccess,
    service: new AttendanceLocationService(
      model as unknown as Model<WorkLocationAssignmentDocument>,
      clock as unknown as BusinessClockService,
      regionAccess as unknown as RegionAccessService,
    ),
  };
}

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(ASSIGNMENT_ID),
    studentId: new Types.ObjectId(STUDENT_ID),
    workLocation: WorkLocation.ShanghaiOffice,
    effectiveFrom: new Date('2026-07-31T16:00:00.000Z'),
    effectiveTo: null,
    ...overrides,
  };
}

describe('AttendanceLocationService', () => {
  it('queries the assignment effective at the start of the China business date', async () => {
    const { service, model } = createService(assignment());

    await service.findEffectiveLocation(STUDENT_ID, '2026-08-05');

    expect(model.findOne).toHaveBeenCalledWith({
      studentId: new Types.ObjectId(STUDENT_ID),
      effectiveFrom: { $lte: new Date('2026-08-04T16:00:00.000Z') },
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gt: new Date('2026-08-04T16:00:00.000Z') } },
      ],
    });
  });

  it('returns the location assignment and its stable region code', async () => {
    const current = assignment();
    const { service, regionAccess } = createService(current);

    const result = await service.findEffectiveLocation(
      STUDENT_ID,
      '2026-08-05',
    );

    expect(regionAccess.getRegionForWorkLocation).toHaveBeenCalledWith(
      WorkLocation.ShanghaiOffice,
    );
    expect(result).toEqual({
      assignmentId: ASSIGNMENT_ID,
      studentId: STUDENT_ID,
      workLocation: WorkLocation.ShanghaiOffice,
      regionCode: RegionCode.Shanghai,
      effectiveFrom: current.effectiveFrom,
      effectiveTo: null,
    });
  });

  it('resolves an online assignment to the online region', async () => {
    const current = assignment({ workLocation: WorkLocation.Online });
    const { service } = createService(current, RegionCode.Online);

    const result = await service.findEffectiveLocation(
      STUDENT_ID,
      '2026-08-05',
    );

    expect(result?.regionCode).toBe(RegionCode.Online);
  });

  it('returns null when the student has no assignment on that date', async () => {
    const { service, regionAccess } = createService(null);

    await expect(
      service.findEffectiveLocation(STUDENT_ID, '2026-08-05'),
    ).resolves.toBeNull();
    expect(regionAccess.getRegionForWorkLocation).not.toHaveBeenCalled();
  });

  it('uses the BusinessClock date when resolving today', async () => {
    const { service, clock, model } = createService(null);

    await service.findTodayEffectiveLocation(STUDENT_ID);

    expect(clock.getBusinessDate).toHaveBeenCalledTimes(1);
    expect(model.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        effectiveFrom: { $lte: new Date('2026-08-04T16:00:00.000Z') },
      }),
    );
  });

  it('rejects an invalid student ID before querying MongoDB', async () => {
    const { service, model } = createService();

    await expect(
      service.findEffectiveLocation('invalid-id', '2026-08-05'),
    ).rejects.toThrow(BadRequestException);
    expect(model.findOne).not.toHaveBeenCalled();
  });

  it.each(['2026-02-30', '2026/08/05', ''])(
    'rejects an invalid attendance date: %s',
    async (attendanceDate) => {
      const { service, model } = createService();

      await expect(
        service.findEffectiveLocation(STUDENT_ID, attendanceDate),
      ).rejects.toThrow(BadRequestException);
      expect(model.findOne).not.toHaveBeenCalled();
    },
  );
});
