import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Param,
  Patch,
  Req,
} from '@nestjs/common';
import { CreateStudentDto } from '../student/dto/create-student.dto';
import { StudentService } from '../student/student.service';
import { HrAuthGuard } from '../auth/guards/hr-auth.guard';
import { ListStudentsQueryDto } from '../student/dto/list-students-query.dto';
import type { AuthenticatedHrRequest } from '../auth/interfaces/authenticated-hr-request.interface';
import { UpdateStudentArrangementDto } from '../student/dto/update-student-arrangement.dto';
import { BatchUpdateStudentArrangementDto } from '../student/dto/batch-update-student-arrangement.dto';

@Controller('hr/students')
@UseGuards(HrAuthGuard)
export class HrStudentsController {
  constructor(private readonly studentService: StudentService) {}

  @Post()
  create(@Body() dto: CreateStudentDto) {
    return this.studentService.create(dto);
  }
  @Get()
  findAll(@Query() query: ListStudentsQueryDto) {
    // The guard has already verified that this request belongs to an HR user.
    return this.studentService.findAll(query);
  }
  @Patch('batch-arrangement')
  batchUpdateArrangement(
    @Body() dto: BatchUpdateStudentArrangementDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.studentService.batchUpdateArrangement(dto, request.hrUser.sub);
  }
  @Patch(':id/arrangement')
  updateArrangement(
    @Param('id') id: string,
    @Body() dto: UpdateStudentArrangementDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.studentService.updateArrangement(id, dto, request.hrUser.sub);
  }
}
