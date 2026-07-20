import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { STUDENT_AUTH_COOKIE } from '../auth.constants';
import type { AuthenticatedStudentRequest } from '../interfaces/authenticated-student-request.interface';
import type { StudentJwtPayload } from '../interfaces/student-jwt-payload.interface';

@Injectable()
export class StudentAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedStudentRequest>();

    const token = this.extractTokenFromCookie(request);

    if (!token) {
      throw new UnauthorizedException('请先登录');
    }

    try {
      // verifyAsync 会验证 JWT 签名以及过期时间。
      const payload =
        await this.jwtService.verifyAsync<StudentJwtPayload>(token);

      // HR 和学生共用签名密钥，因此还需要检查 token 的身份类型。
      if (payload.actor !== 'student') {
        throw new UnauthorizedException();
      }

      // 后续 Controller 可以直接读取当前学生身份。
      request.studentUser = payload;

      return true;
    } catch {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
  }

  private extractTokenFromCookie(
    request: AuthenticatedStudentRequest,
  ): string | undefined {
    // cookie-parser 会把 Cookie 解析到 request.cookies 中。
    const token: unknown = request.cookies?.[STUDENT_AUTH_COOKIE];

    return typeof token === 'string' ? token : undefined;
  }
}
