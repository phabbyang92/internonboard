import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HR_AUTH_COOKIE } from '../auth.constants';
import type { AuthenticatedHrRequest } from '../interfaces/authenticated-hr-request.interface';
import type { HrJwtPayload } from '../interfaces/hr-jwt-payload.interface';

@Injectable()
export class HrAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedHrRequest>();

    const token = this.extractTokenFromCookie(request);

    if (!token) {
      throw new UnauthorizedException('请先登录');
    }

    try {
      // verifyAsync checks the signature and expiration time.
      const payload = await this.jwtService.verifyAsync<HrJwtPayload>(token);

      // HR 和学生共用签名密钥，所以必须检查 token 的身份类型。
      if (payload.actor !== 'hr') {
        throw new UnauthorizedException();
      }

      request.hrUser = payload;

      return true;
    } catch {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
  }

  private extractTokenFromCookie(
    request: AuthenticatedHrRequest,
  ): string | undefined {
    // cookie-parser places parsed cookies on request.cookies.
    const token: unknown = request.cookies?.[HR_AUTH_COOKIE];

    return typeof token === 'string' ? token : undefined;
  }
}
