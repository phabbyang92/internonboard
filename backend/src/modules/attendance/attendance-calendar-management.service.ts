import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, QueryFilter } from 'mongoose';
import { isValidObjectId, Types } from 'mongoose';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { OperationAction } from '../operation-log/enums/operation-action.enum';
import { OperationTargetType } from '../operation-log/enums/operation-target-type.enum';
import { OperationLogService } from '../operation-log/operation-log.service';
import { RegionAccessService } from './access/region-access.service';
import { ATTENDANCE_DATE_PATTERN } from './attendance.constants';
import type { CreateCalendarExceptionDto } from './dto/create-calendar-exception.dto';
import type { ListCalendarExceptionsQueryDto } from './dto/list-calendar-exceptions-query.dto';
import type { UpdateCalendarExceptionDto } from './dto/update-calendar-exception.dto';
import { AttendanceCalendarScope } from './enums/attendance-calendar-scope.enum';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import { CalendarExceptionType } from './enums/calendar-exception-type.enum';
import type { RegionCode } from './enums/region-code.enum';
import type { CalendarExceptionResponse } from './interfaces/calendar-exception-response.interface';
import {
  AttendanceCalendar,
  type AttendanceCalendarDocument,
} from './schemas/attendance-calendar.schema';

const MAX_CALENDAR_RANGE_DAYS = 366;

interface CalendarResponseRecord {
  _id: Types.ObjectId;
  date: string;
  name: string;
  type: CalendarExceptionType;
  scope: AttendanceCalendarScope;
  regionCode: RegionCode | null;
  reason: string | null;
  createdByHrId: Types.ObjectId;
  updatedByHrId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AttendanceCalendarManagementService {
  constructor(
    @InjectModel(AttendanceCalendar.name)
    private readonly calendarModel: Model<AttendanceCalendarDocument>,
    private readonly regionAccessService: RegionAccessService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async list(
    query: ListCalendarExceptionsQueryDto,
    access: HrAccessContext,
  ): Promise<{ month: string; items: CalendarExceptionResponse[] }> {
    this.validateListFilters(query);
    const managedRegionCodes =
      await this.regionAccessService.getManagedRegionCodes(access);

    const filter: QueryFilter<AttendanceCalendarDocument> = {
      isDeleted: false,
      date: { $gte: `${query.month}-01`, $lte: `${query.month}-31` },
    };

    if (query.scope === AttendanceCalendarScope.Global) {
      filter.scope = AttendanceCalendarScope.Global;
      filter.regionCode = null;
    } else if (
      query.scope === AttendanceCalendarScope.Region ||
      query.regionCode
    ) {
      this.assertRegionIsReadable(query.regionCode, managedRegionCodes);
      filter.scope = AttendanceCalendarScope.Region;
      filter.regionCode = query.regionCode;
    } else {
      // 普通 HR 默认看到全国假期与自己负责地区的临时假期。
      filter.$or = [
        {
          scope: AttendanceCalendarScope.Global,
          regionCode: null,
        },
        {
          scope: AttendanceCalendarScope.Region,
          regionCode: { $in: managedRegionCodes },
        },
      ];
    }

    const records = await this.calendarModel
      .find(filter)
      .sort({ date: 1, scope: 1, regionCode: 1 })
      .lean()
      .exec();

    return {
      month: query.month,
      items: records.map((record) => this.toResponse(record)),
    };
  }

  async create(
    dto: CreateCalendarExceptionDto,
    access: HrAccessContext,
  ): Promise<{ createdCount: number; items: CalendarExceptionResponse[] }> {
    const dates = this.expandDateRange(dto.startDate, dto.endDate);
    const calendarKind = this.resolveCalendarKind(dto.scope, dto.regionCode);
    await this.regionAccessService.assertCanManageCalendar(
      access,
      dto.scope,
      calendarKind.regionCode,
    );
    const hrObjectId = this.toHrObjectId(access.hrUserId);
    const normalizedReason = dto.reason || null;

    const existing = await this.calendarModel
      .findOne({
        date: { $in: dates },
        scope: dto.scope,
        regionCode: calendarKind.regionCode,
        isDeleted: false,
      })
      .select({ date: 1 })
      .lean()
      .exec();

    if (existing) {
      throw this.conflictException(existing.date);
    }

    try {
      const records = await this.calendarModel.insertMany(
        dates.map((date) => ({
          date,
          name: dto.name,
          type: calendarKind.type,
          scope: dto.scope,
          regionCode: calendarKind.regionCode,
          reason: normalizedReason,
          createdByHrId: hrObjectId,
          updatedByHrId: hrObjectId,
          isDeleted: false,
          deletedAt: null,
        })),
        { ordered: true },
      );

      const response = {
        createdCount: records.length,
        items: records.map((record) => this.toResponse(record)),
      };

      await this.operationLogService.record({
        operatorHrId: access.hrUserId,
        targetType: OperationTargetType.AttendanceCalendar,
        targetId: records[0]._id.toString(),
        action: OperationAction.AttendanceCalendarCreated,
        changes: {
          calendarIds: records.map((record) => record._id.toString()),
          startDate: dto.startDate,
          endDate: dto.endDate,
          name: dto.name,
          scope: dto.scope,
          regionCode: calendarKind.regionCode,
          reason: normalizedReason,
          createdCount: records.length,
        },
      });

      return response;
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        throw this.conflictException();
      }

      throw error;
    }
  }

  async update(
    calendarId: string,
    dto: UpdateCalendarExceptionDto,
    access: HrAccessContext,
  ): Promise<CalendarExceptionResponse> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('至少提供一个需要修改的字段');
    }

    const objectId = this.toCalendarObjectId(calendarId);

    const existing = await this.calendarModel
      .findOne({ _id: objectId, isDeleted: false })
      .lean()
      .exec();

    if (!existing) {
      throw this.notFoundException();
    }

    await this.regionAccessService.assertCanManageCalendar(
      access,
      existing.scope,
      existing.regionCode,
    );

    const date = dto.date ?? existing.date;
    this.parseDate(date);
    const scope = dto.scope ?? existing.scope;
    const requestedRegionCode = Object.prototype.hasOwnProperty.call(
      dto,
      'regionCode',
    )
      ? (dto.regionCode ?? null)
      : existing.regionCode;
    const calendarKind = this.resolveCalendarKind(
      scope,
      requestedRegionCode ?? undefined,
    );
    await this.regionAccessService.assertCanManageCalendar(
      access,
      scope,
      calendarKind.regionCode,
    );

    const duplicate = await this.calendarModel
      .findOne({
        _id: { $ne: objectId },
        date,
        scope,
        regionCode: calendarKind.regionCode,
        isDeleted: false,
      })
      .select({ date: 1 })
      .lean()
      .exec();

    if (duplicate) {
      throw this.conflictException(date);
    }

    try {
      const updated = await this.calendarModel
        .findOneAndUpdate(
          { _id: objectId, isDeleted: false },
          {
            $set: {
              date,
              name: dto.name ?? existing.name,
              type: calendarKind.type,
              scope,
              regionCode: calendarKind.regionCode,
              reason:
                dto.reason === undefined ? existing.reason : dto.reason || null,
              updatedByHrId: this.toHrObjectId(access.hrUserId),
            },
          },
          { new: true, runValidators: true },
        )
        .lean()
        .exec();

      if (!updated) {
        throw this.notFoundException();
      }

      const response = this.toResponse(updated);

      await this.operationLogService.record({
        operatorHrId: access.hrUserId,
        targetType: OperationTargetType.AttendanceCalendar,
        targetId: updated._id.toString(),
        action: OperationAction.AttendanceCalendarUpdated,
        changes: {
          before: this.toAuditSnapshot(existing),
          after: this.toAuditSnapshot(updated),
        },
      });

      return response;
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        throw this.conflictException(date);
      }

      throw error;
    }
  }

  async remove(
    calendarId: string,
    access: HrAccessContext,
  ): Promise<{ id: string; deletedAt: Date }> {
    const objectId = this.toCalendarObjectId(calendarId);
    const deletedAt = new Date();

    const existing = await this.calendarModel
      .findOne({ _id: objectId, isDeleted: false })
      .lean()
      .exec();

    if (!existing) {
      throw this.notFoundException();
    }

    await this.regionAccessService.assertCanManageCalendar(
      access,
      existing.scope,
      existing.regionCode,
    );

    const record = await this.calendarModel
      .findOneAndUpdate(
        { _id: objectId, isDeleted: false },
        {
          $set: {
            isDeleted: true,
            deletedAt,
            updatedByHrId: this.toHrObjectId(access.hrUserId),
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!record) {
      throw this.notFoundException();
    }

    await this.operationLogService.record({
      operatorHrId: access.hrUserId,
      targetType: OperationTargetType.AttendanceCalendar,
      targetId: record._id.toString(),
      action: OperationAction.AttendanceCalendarDeleted,
      changes: {
        deletedAt,
        record: this.toAuditSnapshot(existing),
      },
    });

    return { id: record._id.toString(), deletedAt };
  }

  private assertRegionIsReadable(
    regionCode: RegionCode | undefined,
    managedRegionCodes: RegionCode[],
  ): asserts regionCode is RegionCode {
    if (!regionCode || !managedRegionCodes.includes(regionCode)) {
      throw new ForbiddenException('无权查看该地区的考勤配置');
    }
  }

  private validateListFilters(query: ListCalendarExceptionsQueryDto): void {
    if (
      query.scope === AttendanceCalendarScope.Global &&
      query.regionCode !== undefined
    ) {
      throw new BadRequestException('查询全国假期时不能指定地区');
    }

    if (
      query.scope === AttendanceCalendarScope.Region &&
      query.regionCode === undefined
    ) {
      throw new BadRequestException('查询地区假期时必须指定地区');
    }
  }

  private resolveCalendarKind(
    scope: AttendanceCalendarScope,
    regionCode?: RegionCode | null,
  ): { type: CalendarExceptionType; regionCode: RegionCode | null } {
    if (scope === AttendanceCalendarScope.Global) {
      if (regionCode !== undefined && regionCode !== null) {
        throw new BadRequestException('全国假期不能指定地区');
      }

      return {
        type: CalendarExceptionType.PublicHoliday,
        regionCode: null,
      };
    }

    if (!regionCode) {
      throw new BadRequestException('地区假期必须指定地区');
    }

    return {
      type: CalendarExceptionType.TemporaryHoliday,
      regionCode,
    };
  }

  private expandDateRange(startDate: string, endDate: string): string[] {
    const start = this.parseDate(startDate);
    const end = this.parseDate(endDate);

    if (start.getTime() > end.getTime()) {
      throw new BadRequestException({
        code: AttendanceErrorCode.CalendarDateRangeInvalid,
        message: '开始日期不能晚于结束日期',
      });
    }

    const dayCount =
      Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;

    if (dayCount > MAX_CALENDAR_RANGE_DAYS) {
      throw new BadRequestException({
        code: AttendanceErrorCode.CalendarDateRangeTooLarge,
        message: `单次最多创建 ${MAX_CALENDAR_RANGE_DAYS} 天的日历配置`,
      });
    }

    return Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + index);
      return date.toISOString().slice(0, 10);
    });
  }

  private parseDate(dateString: string): Date {
    if (!ATTENDANCE_DATE_PATTERN.test(dateString)) {
      throw new BadRequestException({
        code: AttendanceErrorCode.CalendarDateRangeInvalid,
        message: '日历日期格式必须为 YYYY-MM-DD',
      });
    }

    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException({
        code: AttendanceErrorCode.CalendarDateRangeInvalid,
        message: '日历日期无效',
      });
    }

    return date;
  }

  private toHrObjectId(hrUserId: string): Types.ObjectId {
    if (!isValidObjectId(hrUserId)) {
      throw new BadRequestException('HR ID 格式错误');
    }

    return new Types.ObjectId(hrUserId);
  }

  private toCalendarObjectId(calendarId: string): Types.ObjectId {
    if (!isValidObjectId(calendarId)) {
      throw new BadRequestException('日历记录 ID 格式错误');
    }

    return new Types.ObjectId(calendarId);
  }

  private conflictException(date?: string): ConflictException {
    return new ConflictException({
      code: AttendanceErrorCode.CalendarExceptionConflict,
      message: date
        ? `${date} 已存在相同范围的假期配置`
        : '日期范围内已存在相同范围的假期配置',
    });
  }

  private notFoundException(): NotFoundException {
    return new NotFoundException({
      code: AttendanceErrorCode.CalendarExceptionNotFound,
      message: '假期配置不存在或已删除',
    });
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000
    );
  }

  private toAuditSnapshot(record: CalendarResponseRecord) {
    return {
      date: record.date,
      name: record.name,
      type: record.type,
      scope: record.scope,
      regionCode: record.regionCode,
      reason: record.reason,
    };
  }

  private toResponse(
    record: CalendarResponseRecord,
  ): CalendarExceptionResponse {
    return {
      id: record._id.toString(),
      date: record.date,
      name: record.name,
      type: record.type,
      scope: record.scope,
      regionCode: record.regionCode,
      reason: record.reason,
      createdByHrId: record.createdByHrId.toString(),
      updatedByHrId: record.updatedByHrId.toString(),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
