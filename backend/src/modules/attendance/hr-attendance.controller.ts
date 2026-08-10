import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { HrAuthGuard } from '../auth/guards/hr-auth.guard';
import type { AuthenticatedHrRequest } from '../auth/interfaces/authenticated-hr-request.interface';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { CorrectAttendanceRecordDto } from './dto/correct-attendance-record.dto';
import { GetHrStudentAttendanceQueryDto } from './dto/get-hr-student-attendance-query.dto';
import { ListHrAttendanceSummaryQueryDto } from './dto/list-hr-attendance-summary-query.dto';
import { ListHrDailyAttendanceQueryDto } from './dto/list-hr-daily-attendance-query.dto';
import { HrAttendanceSummaryService } from './hr-attendance-summary.service';
import { HrAttendanceCorrectionService } from './hr-attendance-correction.service';
import { HrDailyAttendanceService } from './hr-daily-attendance.service';
import { HrStudentAttendanceService } from './hr-student-attendance.service';

@Controller('hr/attendance')
@UseGuards(HrAuthGuard)
export class HrAttendanceController {
  constructor(
    private readonly dailyAttendanceService: HrDailyAttendanceService,
    private readonly attendanceSummaryService: HrAttendanceSummaryService,
    private readonly studentAttendanceService: HrStudentAttendanceService,
    private readonly attendanceCorrectionService: HrAttendanceCorrectionService,
  ) {}

  @Get('daily')
  listDaily(
    @Query() query: ListHrDailyAttendanceQueryDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.dailyAttendanceService.listDaily(
      query,
      this.getAccess(request),
    );
  }

  @Patch('students/:studentId/records/:attendanceDate')
  correctAttendance(
    @Param('studentId') studentId: string,
    @Param('attendanceDate') attendanceDate: string,
    @Body() dto: CorrectAttendanceRecordDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.attendanceCorrectionService.correctAttendance(
      studentId,
      attendanceDate,
      dto,
      this.getAccess(request),
    );
  }

  @Get('summary')
  listSummary(
    @Query() query: ListHrAttendanceSummaryQueryDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.attendanceSummaryService.listSummary(
      query,
      this.getAccess(request),
    );
  }

  @Get('students/:studentId')
  getStudentAttendance(
    @Param('studentId') studentId: string,
    @Query() query: GetHrStudentAttendanceQueryDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.studentAttendanceService.getStudentAttendance(
      studentId,
      query,
      this.getAccess(request),
    );
  }

  private getAccess(request: AuthenticatedHrRequest): HrAccessContext {
    return {
      hrUserId: request.hrUser.sub,
      role: request.hrUser.role,
    };
  }
}
