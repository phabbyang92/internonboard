import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { StudentAuthGuard } from '../auth/guards/student-auth.guard';
import type { AuthenticatedStudentRequest } from '../auth/interfaces/authenticated-student-request.interface';
import type { StudentPortalResponse } from './interfaces/student-portal-response.interface';
import { StudentPortalService } from './student-portal.service';

@Controller('student')
@UseGuards(StudentAuthGuard)
export class StudentPortalController {
  constructor(private readonly studentPortalService: StudentPortalService) {}

  @Get('portal')
  getPortal(
    @Req() request: AuthenticatedStudentRequest,
  ): Promise<StudentPortalResponse> {
    return this.studentPortalService.getPortal(request.studentUser.sub);
  }
}
