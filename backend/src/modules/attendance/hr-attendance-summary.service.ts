import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, PipelineStage, QueryFilter } from 'mongoose';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { HrAttendanceAccessService } from './access/hr-attendance-access.service';
import { getAttendanceMonthRange } from './attendance.constants';
import { AttendanceQueryPreparationService } from './attendance-query-preparation.service';
import type { ListHrAttendanceSummaryQueryDto } from './dto/list-hr-attendance-summary-query.dto';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { CheckInMode } from './enums/check-in-mode.enum';
import { HrAttendanceSummarySort } from './enums/hr-attendance-sort.enum';
import type {
  HrAttendanceStatusDates,
  HrAttendanceSummaryResponse,
} from './interfaces/hr-attendance-response.interface';
import {
  AttendanceRecord,
  type AttendanceRecordDocument,
} from './schemas/attendance-record.schema';

interface SummaryAggregateItem {
  studentId: { toString(): string };
  studentName: string;
  studentEmail: string;
  ownerHrId: { toString(): string };
  ownerHrName: string;
  totalAttendanceDays: number;
  lateDates: string[];
  leaveDates: string[];
  absentDates: string[];
  onlineAttendanceDays: number;
  offlineAttendanceDays: number;
  latestCheckInAt: Date | null;
  latestAttendanceDate: string | null;
  latestAssignedWorkLocation: string | null;
  latestCheckInMode: CheckInMode | null;
  latestCheckInLocation: string | null;
}

interface SummaryAggregateResult {
  metadata: Array<{ total: number }>;
  items: SummaryAggregateItem[];
}

const ATTENDANCE_STATUSES = [AttendanceStatus.OnTime, AttendanceStatus.Late];

@Injectable()
export class HrAttendanceSummaryService {
  constructor(
    @InjectModel(AttendanceRecord.name)
    private readonly attendanceRecordModel: Model<AttendanceRecordDocument>,
    private readonly accessService: HrAttendanceAccessService,
    private readonly queryPreparationService: AttendanceQueryPreparationService,
  ) {}

  async listSummary(
    query: ListHrAttendanceSummaryQueryDto,
    access: HrAccessContext,
  ): Promise<HrAttendanceSummaryResponse> {
    const scope = await this.accessService.resolveAttendanceScope(
      access,
      query.ownerHrId,
    );

    // 历史月份补齐整月，当前月份只补到北京时间今天，未来月份不扫描。
    await this.queryPreparationService.prepareHrMonth(
      query.month,
      scope.access,
      undefined,
      scope.ownerHrId?.toString() ?? null,
    );

    const { startDate, nextMonthStartDate } = getAttendanceMonthRange(
      query.month,
    );
    const match: QueryFilter<AttendanceRecord> = {
      attendanceDate: {
        $gte: startDate,
        $lt: nextMonthStartDate,
      },
    };

    if (scope.ownerHrId) {
      match.ownerHrId = scope.ownerHrId;
    }

    if (query.workLocation) {
      match.assignedWorkLocation = query.workLocation;
    }

    if (query.checkInMode) {
      match.checkInMode = query.checkInMode;
    }

    const [result] = await this.attendanceRecordModel
      .aggregate<SummaryAggregateResult>(this.buildPipeline(match, query))
      .exec();
    const total = result?.metadata[0]?.total ?? 0;

    return {
      month: query.month,
      items: (result?.items ?? []).map((item) => ({
        student: {
          id: item.studentId.toString(),
          name: item.studentName,
          email: item.studentEmail,
          ownerHr: {
            id: item.ownerHrId.toString(),
            name: item.ownerHrName,
          },
        },
        summary: {
          totalAttendanceDays: item.totalAttendanceDays,
          late: this.serializeStatusDates(item.lateDates),
          leave: this.serializeStatusDates(item.leaveDates),
          absent: this.serializeStatusDates(item.absentDates),
          onlineAttendanceDays: item.onlineAttendanceDays,
          offlineAttendanceDays: item.offlineAttendanceDays,
          latestCheckIn: this.serializeLatestCheckIn(item),
        },
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private buildPipeline(
    match: QueryFilter<AttendanceRecord>,
    query: ListHrAttendanceSummaryQueryDto,
  ): PipelineStage[] {
    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      {
        $unwind: {
          path: '$student',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'hr_users',
          localField: 'ownerHrId',
          foreignField: '_id',
          as: 'ownerHr',
        },
      },
      {
        $unwind: {
          path: '$ownerHr',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    if (query.keyword) {
      const keyword = new RegExp(this.escapeRegex(query.keyword), 'i');
      pipeline.push({
        $match: {
          $or: [
            { 'student.name': keyword },
            { 'student.email': keyword },
            { 'student.phone': keyword },
          ],
        },
      });
    }

    pipeline.push(
      {
        $addFields: {
          _checkInMissing: {
            $cond: [{ $eq: ['$checkInAt', null] }, 1, 0],
          },
        },
      },
      // 先把最新有效打卡排在每名学生的第一条，随后用 $first 保留其地点快照。
      {
        $sort: {
          studentId: 1,
          _checkInMissing: 1,
          checkInAt: -1,
          attendanceDate: -1,
          _id: 1,
        },
      },
      {
        $group: {
          _id: '$studentId',
          studentId: { $first: '$studentId' },
          studentName: { $first: { $ifNull: ['$student.name', '未知学生'] } },
          studentEmail: { $first: { $ifNull: ['$student.email', ''] } },
          ownerHrId: { $first: '$ownerHrId' },
          ownerHrName: { $first: { $ifNull: ['$ownerHr.name', '未知 HR'] } },
          totalAttendanceDays: {
            $sum: {
              $cond: [{ $in: ['$status', ATTENDANCE_STATUSES] }, 1, 0],
            },
          },
          lateDates: this.collectStatusDates(AttendanceStatus.Late),
          leaveDates: this.collectStatusDates(AttendanceStatus.Leave),
          absentDates: this.collectStatusDates(AttendanceStatus.Absent),
          onlineAttendanceDays: this.countAttendanceMode(CheckInMode.Online),
          offlineAttendanceDays: this.countAttendanceMode(CheckInMode.Offline),
          latestCheckInAt: { $first: '$checkInAt' },
          latestAttendanceDate: { $first: '$attendanceDate' },
          latestAssignedWorkLocation: { $first: '$assignedWorkLocation' },
          latestCheckInMode: { $first: '$checkInMode' },
          latestCheckInLocation: { $first: '$checkInLocation' },
        },
      },
      {
        $addFields: {
          lateDates: this.removeNullDates('$lateDates'),
          leaveDates: this.removeNullDates('$leaveDates'),
          absentDates: this.removeNullDates('$absentDates'),
          _studentNameSort: { $toLower: '$studentName' },
          _latestCheckInMissing: {
            $cond: [{ $eq: ['$latestCheckInAt', null] }, 1, 0],
          },
        },
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          items: [
            { $sort: this.getSort(query.sortBy) },
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
            {
              $project: {
                studentId: 1,
                studentName: 1,
                studentEmail: 1,
                ownerHrId: 1,
                ownerHrName: 1,
                totalAttendanceDays: 1,
                lateDates: 1,
                leaveDates: 1,
                absentDates: 1,
                onlineAttendanceDays: 1,
                offlineAttendanceDays: 1,
                latestCheckInAt: 1,
                latestAttendanceDate: 1,
                latestAssignedWorkLocation: 1,
                latestCheckInMode: 1,
                latestCheckInLocation: 1,
              },
            },
          ],
        },
      },
    );

    return pipeline;
  }

  private collectStatusDates(status: AttendanceStatus) {
    return {
      $push: {
        $cond: [{ $eq: ['$status', status] }, '$attendanceDate', null],
      },
    };
  }

  private countAttendanceMode(mode: CheckInMode) {
    return {
      $sum: {
        $cond: [
          {
            $and: [
              { $in: ['$status', ATTENDANCE_STATUSES] },
              { $eq: ['$checkInMode', mode] },
            ],
          },
          1,
          0,
        ],
      },
    };
  }

  private removeNullDates(input: string) {
    return {
      $filter: {
        input,
        as: 'attendanceDate',
        cond: { $ne: ['$$attendanceDate', null] },
      },
    };
  }

  private getSort(sortBy: HrAttendanceSummarySort): Record<string, 1 | -1> {
    if (sortBy === HrAttendanceSummarySort.TotalAttendanceDaysDesc) {
      return {
        totalAttendanceDays: -1,
        _studentNameSort: 1,
        _id: 1,
      };
    }

    if (sortBy === HrAttendanceSummarySort.LatestCheckInAtDesc) {
      return {
        _latestCheckInMissing: 1,
        latestCheckInAt: -1,
        _studentNameSort: 1,
        _id: 1,
      };
    }

    return { _studentNameSort: 1, _id: 1 };
  }

  private serializeStatusDates(dates: string[]): HrAttendanceStatusDates {
    const sortedDates = [...dates].sort();
    return { count: sortedDates.length, dates: sortedDates };
  }

  private serializeLatestCheckIn(item: SummaryAggregateItem) {
    if (
      !item.latestCheckInAt ||
      !item.latestAttendanceDate ||
      !item.latestAssignedWorkLocation ||
      !item.latestCheckInMode
    ) {
      return null;
    }

    return {
      attendanceDate: item.latestAttendanceDate,
      checkInAt: item.latestCheckInAt,
      assignedWorkLocation: item.latestAssignedWorkLocation,
      checkInMode: item.latestCheckInMode,
      checkInLocation: item.latestCheckInLocation ?? null,
    };
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
