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
import { HR_AUTH_COOKIE, HR_AUTH_COOKIE_MAX_AGE_MS } from './auth.constants';
import { AuthService } from './auth.service';
import { HrLoginDto } from './dto/hr-login.dto';
import { HrAuthGuard } from './guards/hr-auth.guard';
import type { AuthenticatedHrRequest } from './interfaces/authenticated-hr-request.interface';

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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: HrLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, user } = await this.authService.login(dto);

    // HttpOnly prevents frontend JavaScript from reading the token.
    response.cookie(HR_AUTH_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: HR_AUTH_COOKIE_MAX_AGE_MS,
      path: '/',
    });

    // Never return the token or password hash in the response body.
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    // Cookie options should match the options used during login.
    response.clearCookie(HR_AUTH_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }
}
