import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, PipelineStage, QueryFilter } from 'mongoose';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { HrAttendanceAccessService } from './access/hr-attendance-access.service';
import { AttendanceQueryPreparationService } from './attendance-query-preparation.service';
import type { ListHrDailyAttendanceQueryDto } from './dto/list-hr-daily-attendance-query.dto';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { HrDailyAttendanceStatusFilter } from './enums/hr-daily-attendance-status-filter.enum';
import { HrDailyAttendanceSort } from './enums/hr-attendance-sort.enum';
import type { HrDailyAttendanceResponse } from './interfaces/hr-attendance-response.interface';
import {
  AttendanceRecord,
  type AttendanceRecordDocument,
} from './schemas/attendance-record.schema';

interface DailyAggregateSummary {
  totalStudents: number;
  checkedIn: number;
  onTime: number;
  late: number;
  leave: number;
  absent: number;
}

interface DailyAggregateItem {
  _id: { toString(): string };
  attendanceDate: string;
  status: AttendanceRecord['status'];
  lateLevel: AttendanceRecord['lateLevel'];
  source: AttendanceRecord['source'];
  checkInAt: Date | null;
  assignedWorkLocation: string;
  checkInMode: AttendanceRecord['checkInMode'];
  checkInLocation: string | null;
  studentId: { toString(): string };
  studentName: string;
  studentEmail: string;
  ownerHrId: { toString(): string };
  ownerHrName: string;
  correctedByHrId?: { toString(): string } | null;
  correctedAt?: Date | null;
  correctionReason?: string | null;
  originalStatus?: AttendanceRecord['originalStatus'];
  correctionCount?: number;
}

interface DailyAggregateResult {
  summary: DailyAggregateSummary[];
  metadata: Array<{ total: number }>;
  items: DailyAggregateItem[];
}

const EMPTY_SUMMARY: DailyAggregateSummary = {
  totalStudents: 0,
  checkedIn: 0,
  onTime: 0,
  late: 0,
  leave: 0,
  absent: 0,
};

@Injectable()
export class HrDailyAttendanceService {
  constructor(
    @InjectModel(AttendanceRecord.name)
    private readonly attendanceRecordModel: Model<AttendanceRecordDocument>,
    private readonly accessService: HrAttendanceAccessService,
    private readonly queryPreparationService: AttendanceQueryPreparationService,
  ) {}

  async listDaily(
    query: ListHrDailyAttendanceQueryDto,
    access: HrAccessContext,
  ): Promise<HrDailyAttendanceResponse> {
    const scope = await this.accessService.resolveAttendanceScope(
      access,
      query.ownerHrId,
    );

    // 查询前先补齐已到截止时间但尚无最终记录的缺勤学生。
    await this.queryPreparationService.prepareHrDaily(
      query.date,
      scope.access,
      undefined,
      scope.ownerHrId?.toString() ?? null,
    );

    const match: QueryFilter<AttendanceRecord> = {
      attendanceDate: query.date,
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

    const pipeline = this.buildPipeline(match, query);
    const [result] = await this.attendanceRecordModel
      .aggregate<DailyAggregateResult>(pipeline)
      .exec();
    const summary = result?.summary[0] ?? EMPTY_SUMMARY;
    const total = result?.metadata[0]?.total ?? 0;

    return {
      attendanceDate: query.date,
      summary,
      items: (result?.items ?? []).map((item) => ({
        id: item._id.toString(),
        attendanceDate: item.attendanceDate,
        status: item.status,
        lateLevel: item.lateLevel ?? null,
        source: item.source,
        checkInAt: item.checkInAt ?? null,
        assignedWorkLocation: item.assignedWorkLocation,
        checkInMode: item.checkInMode ?? null,
        checkInLocation: item.checkInLocation ?? null,
        correction: this.serializeCorrection(item),
        student: {
          id: item.studentId.toString(),
          name: item.studentName,
          email: item.studentEmail,
          ownerHr: {
            id: item.ownerHrId.toString(),
            name: item.ownerHrName,
          },
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
    query: ListHrDailyAttendanceQueryDto,
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

    const statusFilter = this.getStatusFilter(query.status);

    pipeline.push(
      {
        $addFields: {
          _studentNameSort: {
            $toLower: { $ifNull: ['$student.name', ''] },
          },
          _checkInMissing: {
            $cond: [{ $eq: ['$checkInAt', null] }, 1, 0],
          },
        },
      },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalStudents: { $sum: 1 },
                checkedIn: {
                  $sum: { $cond: [{ $ne: ['$checkInAt', null] }, 1, 0] },
                },
                onTime: this.statusCounter(AttendanceStatus.OnTime),
                late: this.statusCounter(AttendanceStatus.Late),
                leave: this.statusCounter(AttendanceStatus.Leave),
                absent: this.statusCounter(AttendanceStatus.Absent),
              },
            },
            { $project: { _id: 0 } },
          ],
          // 状态卡片始终展示当前日期和其他查询条件下的完整统计；
          // 状态筛选只作用于列表及分页数量，便于 HR 连续切换卡片。
          metadata: [...statusFilter, { $count: 'total' }],
          items: [
            ...statusFilter,
            { $sort: this.getSort(query.sortBy) },
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
            {
              $project: {
                attendanceDate: 1,
                status: 1,
                lateLevel: 1,
                source: 1,
                checkInAt: 1,
                assignedWorkLocation: 1,
                checkInMode: 1,
                checkInLocation: 1,
                correctedByHrId: 1,
                correctedAt: 1,
                correctionReason: 1,
                originalStatus: 1,
                correctionCount: 1,
                studentId: '$studentId',
                studentName: { $ifNull: ['$student.name', '未知学生'] },
                studentEmail: { $ifNull: ['$student.email', ''] },
                ownerHrId: '$ownerHrId',
                ownerHrName: { $ifNull: ['$ownerHr.name', '未知 HR'] },
              },
            },
          ],
        },
      },
    );

    return pipeline;
  }

  private getStatusFilter(
    status?: HrDailyAttendanceStatusFilter,
  ): PipelineStage.Match[] {
    if (!status) return [];

    if (status === HrDailyAttendanceStatusFilter.CheckedIn) {
      return [{ $match: { checkInAt: { $ne: null } } }];
    }

    return [{ $match: { status } }];
  }

  private statusCounter(status: AttendanceStatus) {
    return {
      $sum: { $cond: [{ $eq: ['$status', status] }, 1, 0] },
    };
  }

  private getSort(sortBy: HrDailyAttendanceSort): Record<string, 1 | -1> {
    if (sortBy === HrDailyAttendanceSort.CheckInAtAsc) {
      return {
        _checkInMissing: 1,
        checkInAt: 1,
        _studentNameSort: 1,
        _id: 1,
      };
    }

    if (sortBy === HrDailyAttendanceSort.CheckInAtDesc) {
      return {
        _checkInMissing: 1,
        checkInAt: -1,
        _studentNameSort: 1,
        _id: 1,
      };
    }

    return { _studentNameSort: 1, _id: 1 };
  }

  private serializeCorrection(item: DailyAggregateItem) {
    if (!item.correctedByHrId || !item.correctedAt || !item.correctionReason) {
      return null;
    }

    return {
      correctedByHrId: item.correctedByHrId.toString(),
      correctedAt: item.correctedAt,
      reason: item.correctionReason,
      originalStatus: item.originalStatus ?? null,
      count: item.correctionCount ?? 1,
    };
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
