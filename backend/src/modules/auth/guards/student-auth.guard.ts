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
import { StudentAuthService } from '../student-auth.service';

@Injectable()
export class StudentAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly studentAuthService: StudentAuthService,
  ) {}

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

      // 软删除学生后，旧 Cookie 立即失效；姓名和邮箱也以数据库当前值为准。
      const currentStudent = await this.studentAuthService.getSessionStudent(
        payload.sub,
      );
      request.studentUser = {
        sub: currentStudent.id,
        actor: 'student',
        name: currentStudent.name,
        email: currentStudent.email,
      };

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
