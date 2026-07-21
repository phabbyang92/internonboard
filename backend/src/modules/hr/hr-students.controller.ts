import {
  Body,
  Controller,
  Delete,
  Get,
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
import { BatchUpdateStudentArrangementDto } from '../student/dto/batch-update-student-arrangement.dto';
import { CreateStudentDto } from '../student/dto/create-student.dto';
import { ListStudentsQueryDto } from '../student/dto/list-students-query.dto';
import { UpdateStudentArrangementDto } from '../student/dto/update-student-arrangement.dto';
import { StudentService } from '../student/student.service';
import { ListOperationLogsQueryDto } from './dto/list-operation-logs-query.dto';
import { SoftDeleteStudentDto } from './dto/soft-delete-student.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { HrStudentManagementService } from './hr-student-management.service';

@Controller('hr/students')
@UseGuards(HrAuthGuard)
export class HrStudentsController {
  constructor(
    private readonly studentService: StudentService,
    private readonly hrStudentManagementService: HrStudentManagementService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateStudentDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.hrStudentManagementService.createStudent(
      dto,
      this.getAccess(request),
    );
  }

  @Get()
  findAll(
    @Query() query: ListStudentsQueryDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.studentService.findAll(query, this.getAccess(request));
  }

  @Get(':id/work-location-history')
  getWorkLocationHistory(
    @Param('id') id: string,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.hrStudentManagementService.getWorkLocationHistory(
      id,
      this.getAccess(request),
    );
  }

  @Get(':id/operation-logs')
  getOperationLogs(
    @Param('id') id: string,
    @Query() query: ListOperationLogsQueryDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.hrStudentManagementService.getOperationLogs(
      id,
      query,
      this.getAccess(request),
    );
  }

  @Get(':id')
  findOneById(@Param('id') id: string, @Req() request: AuthenticatedHrRequest) {
    return this.studentService.findOneByIdForHr(id, this.getAccess(request));
  }

  @Patch('batch-arrangement')
  batchUpdateArrangement(
    @Body() dto: BatchUpdateStudentArrangementDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.hrStudentManagementService.batchUpdateArrangement(
      dto,
      this.getAccess(request),
    );
  }

  @Patch(':id/arrangement')
  updateArrangement(
    @Param('id') id: string,
    @Body() dto: UpdateStudentArrangementDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.hrStudentManagementService.updateArrangement(
      id,
      dto,
      this.getAccess(request),
    );
  }

  @Patch(':id/profile')
  updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateStudentProfileDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.hrStudentManagementService.updateProfile(
      id,
      dto,
      this.getAccess(request),
    );
  }

  @Delete(':id')
  softDelete(
    @Param('id') id: string,
    @Body() dto: SoftDeleteStudentDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.hrStudentManagementService.softDeleteStudent(
      id,
      dto,
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
