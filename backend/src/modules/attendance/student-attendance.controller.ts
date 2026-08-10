import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StudentAuthGuard } from '../auth/guards/student-auth.guard';
import type { AuthenticatedStudentRequest } from '../auth/interfaces/authenticated-student-request.interface';
import { AttendanceCheckInService } from './attendance-check-in.service';
import { AttendanceLeaveOptionsService } from './attendance-leave-options.service';
import { AttendanceLeaveCancellationService } from './attendance-leave-cancellation.service';
import { AttendanceLeaveRegistrationService } from './attendance-leave-registration.service';
import { AttendanceDateParamDto } from './dto/attendance-date-param.dto';
import { CreateAttendanceCheckInDto } from './dto/create-attendance-check-in.dto';
import { CreateLeaveRegistrationDto } from './dto/create-leave-registration.dto';
import { ListStudentAttendanceRecordsQueryDto } from './dto/list-student-attendance-records-query.dto';
import type { AttendanceCheckInResponse } from './interfaces/attendance-check-in-response.interface';
import type { LeaveDateOptionsResponse } from './interfaces/leave-date-option.interface';
import type { LeaveCancellationResponse } from './interfaces/leave-cancellation-response.interface';
import type { LeaveRegistrationResponse } from './interfaces/leave-registration-response.interface';
import type { StudentAttendanceRecordsResponse } from './interfaces/student-attendance-records-response.interface';
import type { StudentAttendanceTodayResponse } from './interfaces/student-attendance-today-response.interface';
import { StudentAttendanceReadService } from './student-attendance-read.service';

@Controller('student/attendance')
@UseGuards(StudentAuthGuard)
export class StudentAttendanceController {
  constructor(
    private readonly attendanceCheckInService: AttendanceCheckInService,
    private readonly attendanceLeaveOptionsService: AttendanceLeaveOptionsService,
    private readonly attendanceLeaveRegistrationService: AttendanceLeaveRegistrationService,
    private readonly attendanceLeaveCancellationService: AttendanceLeaveCancellationService,
    private readonly attendanceReadService: StudentAttendanceReadService,
  ) {}

  @Get('today')
  getToday(
    @Req() request: AuthenticatedStudentRequest,
  ): Promise<StudentAttendanceTodayResponse> {
    return this.attendanceReadService.getToday(request.studentUser.sub);
  }

  @Get('records')
  getRecords(
    @Req() request: AuthenticatedStudentRequest,
    @Query() query: ListStudentAttendanceRecordsQueryDto,
  ): Promise<StudentAttendanceRecordsResponse> {
    return this.attendanceReadService.getRecords(
      request.studentUser.sub,
      query.month,
    );
  }

  @Get('leave-options')
  getLeaveOptions(
    @Req() request: AuthenticatedStudentRequest,
  ): Promise<LeaveDateOptionsResponse> {
    return this.attendanceLeaveOptionsService.getOptions(
      request.studentUser.sub,
    );
  }

  @Post('leaves')
  @HttpCode(HttpStatus.CREATED)
  registerLeave(
    @Req() request: AuthenticatedStudentRequest,
    @Body() dto: CreateLeaveRegistrationDto,
  ): Promise<LeaveRegistrationResponse> {
    // 学生身份由登录 Cookie 确定，客户端只提交希望请假的业务日期。
    return this.attendanceLeaveRegistrationService.register(
      request.studentUser.sub,
      dto,
    );
  }

  @Delete('leaves/:attendanceDate')
  @HttpCode(HttpStatus.OK)
  cancelLeave(
    @Req() request: AuthenticatedStudentRequest,
    @Param() params: AttendanceDateParamDto,
  ): Promise<LeaveCancellationResponse> {
    return this.attendanceLeaveCancellationService.cancel(
      request.studentUser.sub,
      params.attendanceDate,
    );
  }

  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  checkIn(
    @Req() request: AuthenticatedStudentRequest,
    @Body() dto: CreateAttendanceCheckInDto,
  ): Promise<AttendanceCheckInResponse> {
    // 学生身份来自已验证的 JWT；客户端不能替其他学生提交打卡。
    return this.attendanceCheckInService.checkIn(
      request.studentUser.sub,
      dto,
      request.ip,
    );
  }
}
