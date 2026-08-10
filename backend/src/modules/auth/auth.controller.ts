import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { HR_AUTH_COOKIE, HR_AUTH_COOKIE_MAX_AGE_MS } from './auth.constants';
import { AuthService } from './auth.service';
import { HrLoginDto } from './dto/hr-login.dto';
import { HrAuthGuard } from './guards/hr-auth.guard';
import type { AuthenticatedHrRequest } from './interfaces/authenticated-hr-request.interface';
import { HrRole } from './enums/hr-role.enum';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { createAuthCookieOptions } from './auth-cookie.options';

@Controller('hr')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(HrAuthGuard)
  getCurrentHr(@Req() request: AuthenticatedHrRequest) {
    const { sub, email, name, role } = request.hrUser;

    return {
      user: { id: sub, email, name, role },
    };
  }

  @Get('users')
  @UseGuards(HrAuthGuard)
  listHrUsers(@Req() request: AuthenticatedHrRequest) {
    if (request.hrUser.role !== HrRole.Admin) {
      throw new ForbiddenException('只有管理员可以查看 HR 账号列表');
    }

    return this.authService.listHrUsers();
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000, blockDuration: 300_000 } })
  async login(
    @Body() dto: HrLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, user } = await this.authService.login(dto);

    // HttpOnly prevents frontend JavaScript from reading the token.
    response.cookie(
      HR_AUTH_COOKIE,
      accessToken,
      createAuthCookieOptions(process.env.NODE_ENV, HR_AUTH_COOKIE_MAX_AGE_MS),
    );

    // Never return the token or password hash in the response body.
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    // Cookie options should match the options used during login.
    response.clearCookie(
      HR_AUTH_COOKIE,
      createAuthCookieOptions(process.env.NODE_ENV),
    );
  }
}
