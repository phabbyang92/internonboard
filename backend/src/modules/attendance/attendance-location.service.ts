import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { isValidObjectId, Types } from 'mongoose';
import { BusinessClockService } from '../../common/time/business-clock.service';
import {
  WorkLocationAssignment,
  type WorkLocationAssignmentDocument,
} from '../work-location/schemas/work-location-assignment.schema';
import { RegionAccessService } from './access/region-access.service';
import { ATTENDANCE_DATE_PATTERN } from './attendance.constants';
import type { AttendanceLocationResult } from './interfaces/attendance-location-result.interface';

@Injectable()
export class AttendanceLocationService {
  constructor(
    @InjectModel(WorkLocationAssignment.name)
    private readonly assignmentModel: Model<WorkLocationAssignmentDocument>,
    private readonly businessClock: BusinessClockService,
    private readonly regionAccessService: RegionAccessService,
  ) {}

  async findEffectiveLocation(
    studentId: string,
    attendanceDate: string,
  ): Promise<AttendanceLocationResult | null> {
    if (!isValidObjectId(studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    const businessDayStart = this.toBusinessDayStart(attendanceDate);
    const assignment = await this.assignmentModel
      .findOne({
        studentId: new Types.ObjectId(studentId),
        effectiveFrom: { $lte: businessDayStart },
        $or: [
          { effectiveTo: null },
          // effectiveTo 是下一段开始时间，因此采用右开区间。
          { effectiveTo: { $gt: businessDayStart } },
        ],
      })
      .sort({ effectiveFrom: -1 })
      .lean()
      .exec();

    if (!assignment) {
      return null;
    }

    return {
      assignmentId: assignment._id.toString(),
      studentId: assignment.studentId.toString(),
      workLocation: assignment.workLocation,
      regionCode: this.regionAccessService.getRegionForWorkLocation(
        assignment.workLocation,
      ),
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo,
    };
  }

  findTodayEffectiveLocation(
    studentId: string,
  ): Promise<AttendanceLocationResult | null> {
    return this.findEffectiveLocation(
      studentId,
      this.businessClock.getBusinessDate(),
    );
  }

  private toBusinessDayStart(attendanceDate: string): Date {
    if (!ATTENDANCE_DATE_PATTERN.test(attendanceDate)) {
      throw new BadRequestException('考勤日期格式必须为 YYYY-MM-DD');
    }

    const [year, month, day] = attendanceDate.split('-').map(Number);
    const calendarDate = new Date(Date.UTC(year, month - 1, day));

    if (
      calendarDate.getUTCFullYear() !== year ||
      calendarDate.getUTCMonth() !== month - 1 ||
      calendarDate.getUTCDate() !== day
    ) {
      throw new BadRequestException('考勤日期无效');
    }

    // 中国标准时间全年为 UTC+8；数据库中的日期安排也按中国零点保存。
    return new Date(`${attendanceDate}T00:00:00+08:00`);
  }
}
