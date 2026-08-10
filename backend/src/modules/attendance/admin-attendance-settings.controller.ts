import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { HrAuthGuard } from '../auth/guards/hr-auth.guard';
import type { AuthenticatedHrRequest } from '../auth/interfaces/authenticated-hr-request.interface';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { AttendanceCalendarManagementService } from './attendance-calendar-management.service';
import { RegionAccessService } from './access/region-access.service';
import { CreateCalendarExceptionDto } from './dto/create-calendar-exception.dto';
import { ListCalendarExceptionsQueryDto } from './dto/list-calendar-exceptions-query.dto';
import { UpdateCalendarExceptionDto } from './dto/update-calendar-exception.dto';

@Controller('hr/attendance/calendar')
@UseGuards(HrAuthGuard)
export class AdminAttendanceSettingsController {
  constructor(
    private readonly calendarManagementService: AttendanceCalendarManagementService,
    private readonly regionAccessService: RegionAccessService,
  ) {}

  @Get('access')
  getAccessSummary(@Req() request: AuthenticatedHrRequest) {
    return this.regionAccessService.getCalendarAccess(this.getAccess(request));
  }

  @Get()
  list(
    @Query() query: ListCalendarExceptionsQueryDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.calendarManagementService.list(query, this.getAccess(request));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateCalendarExceptionDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.calendarManagementService.create(dto, this.getAccess(request));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCalendarExceptionDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.calendarManagementService.update(
      id,
      dto,
      this.getAccess(request),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @Req() request: AuthenticatedHrRequest) {
    return this.calendarManagementService.remove(id, this.getAccess(request));
  }

  private getAccess(request: AuthenticatedHrRequest): HrAccessContext {
    return {
      hrUserId: request.hrUser.sub,
      role: request.hrUser.role,
    };
  }
}
