import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StudentAuthGuard } from '../auth/guards/student-auth.guard';
import type { AuthenticatedStudentRequest } from '../auth/interfaces/authenticated-student-request.interface';
import { SubmitStudentFormDto } from '../student/dto/submit-student-form.dto';
import { StudentService } from '../student/student.service';

@Controller('student/form')
@UseGuards(StudentAuthGuard)
export class StudentFormController {
  constructor(private readonly studentService: StudentService) {}

  @Get()
  async getForm(@Req() request: AuthenticatedStudentRequest) {
    // 学生 ID 必须来自验证后的 JWT，不能接收前端传入的其他学生 ID。
    const form = await this.studentService.findOneById(request.studentUser.sub);

    return { form };
  }
  @Post('submit')
  @HttpCode(HttpStatus.OK)
  async submitForm(
    @Req() request: AuthenticatedStudentRequest,
    @Body() dto: SubmitStudentFormDto,
  ) {
    // 只允许提交 JWT 所属学生自己的登记表。
    return this.studentService.submitForm(request.studentUser.sub, dto);
  }
}
