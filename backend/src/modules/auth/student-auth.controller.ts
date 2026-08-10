import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  STUDENT_AUTH_COOKIE,
  STUDENT_AUTH_COOKIE_MAX_AGE_MS,
} from './auth.constants';
import { StudentLoginDto } from './dto/student-login.dto';
import { StudentAuthService } from './student-auth.service';
import { StudentAuthGuard } from './guards/student-auth.guard';
import type { AuthenticatedStudentRequest } from './interfaces/authenticated-student-request.interface';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { createAuthCookieOptions } from './auth-cookie.options';

@Controller('student')
export class StudentAuthController {
  constructor(private readonly studentAuthService: StudentAuthService) {}
  @Get('me')
  @UseGuards(StudentAuthGuard)
  async getCurrentStudent(@Req() request: AuthenticatedStudentRequest) {
    // sub 是 JWT 中保存的 MongoDB 学生 ID。
    const student = await this.studentAuthService.getCurrentStudent(
      request.studentUser.sub,
    );

    return { student };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000, blockDuration: 60_000 } })
  async login(
    @Body() dto: StudentLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, student } = await this.studentAuthService.login(dto);

    // 学生和 HR 使用不同 Cookie，避免两个登录状态相互覆盖。
    response.cookie(
      STUDENT_AUTH_COOKIE,
      accessToken,
      createAuthCookieOptions(
        process.env.NODE_ENV,
        STUDENT_AUTH_COOKIE_MAX_AGE_MS,
      ),
    );

    // JWT 放在 HttpOnly Cookie 中，不在响应正文中返回。
    return { student };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(
      STUDENT_AUTH_COOKIE,
      createAuthCookieOptions(process.env.NODE_ENV),
    );
  }
}
