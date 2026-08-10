import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HrRole } from '../enums/hr-role.enum';
import type { AuthenticatedHrRequest } from '../interfaces/authenticated-hr-request.interface';
import type { AuthenticatedStudentRequest } from '../interfaces/authenticated-student-request.interface';
import { HrAuthGuard } from './hr-auth.guard';
import { StudentAuthGuard } from './student-auth.guard';
import { AuthService } from '../auth.service';
import { StudentAuthService } from '../student-auth.service';

function createContext<TRequest extends object>(request: TRequest) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('authentication guards', () => {
  describe('HrAuthGuard', () => {
    const verifyAsync = jest.fn();
    const getSessionUser = jest.fn();
    const guard = new HrAuthGuard(
      { verifyAsync } as unknown as JwtService,
      { getSessionUser } as unknown as AuthService,
    );

    beforeEach(() => {
      verifyAsync.mockReset();
      getSessionUser.mockReset();
    });

    it('rejects requests without an HR cookie', async () => {
      const request = {
        cookies: {},
      } as unknown as AuthenticatedHrRequest;

      await expect(guard.canActivate(createContext(request))).rejects.toThrow(
        UnauthorizedException,
      );
      expect(verifyAsync).not.toHaveBeenCalled();
    });

    it('accepts a valid HR token and attaches its payload', async () => {
      const payload = {
        sub: 'hr-id',
        actor: 'hr',
        email: 'hr@example.com',
        name: 'HR',
        role: HrRole.Hr,
      } as const;
      verifyAsync.mockResolvedValue(payload);
      getSessionUser.mockResolvedValue({
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      });
      const request = {
        cookies: { hr_access_token: 'valid-token' },
      } as unknown as AuthenticatedHrRequest;

      await expect(guard.canActivate(createContext(request))).resolves.toBe(
        true,
      );
      expect(request.hrUser).toEqual(payload);
    });

    it('rejects a student token copied into the HR cookie', async () => {
      verifyAsync.mockResolvedValue({
        sub: 'student-id',
        actor: 'student',
      });
      const request = {
        cookies: { hr_access_token: 'student-token' },
      } as unknown as AuthenticatedHrRequest;

      await expect(guard.canActivate(createContext(request))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects invalid or expired tokens', async () => {
      verifyAsync.mockRejectedValue(new Error('expired'));
      const request = {
        cookies: { hr_access_token: 'expired-token' },
      } as unknown as AuthenticatedHrRequest;

      await expect(guard.canActivate(createContext(request))).rejects.toThrow(
        '登录已失效，请重新登录',
      );
    });

    it('rejects a valid token after the HR account no longer exists', async () => {
      verifyAsync.mockResolvedValue({
        sub: 'deleted-hr-id',
        actor: 'hr',
      });
      getSessionUser.mockRejectedValue(new Error('missing account'));
      const request = {
        cookies: { hr_access_token: 'previously-valid-token' },
      } as unknown as AuthenticatedHrRequest;

      await expect(guard.canActivate(createContext(request))).rejects.toThrow(
        '登录已失效，请重新登录',
      );
    });
  });

  describe('StudentAuthGuard', () => {
    const verifyAsync = jest.fn();
    const getSessionStudent = jest.fn();
    const guard = new StudentAuthGuard(
      { verifyAsync } as unknown as JwtService,
      { getSessionStudent } as unknown as StudentAuthService,
    );

    beforeEach(() => {
      verifyAsync.mockReset();
      getSessionStudent.mockReset();
    });

    it('rejects requests without a student cookie', async () => {
      const request = {
        cookies: {},
      } as unknown as AuthenticatedStudentRequest;

      await expect(guard.canActivate(createContext(request))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('accepts a valid student token', async () => {
      const payload = {
        sub: 'student-id',
        actor: 'student',
        name: 'Student',
        email: 'student@example.com',
      } as const;
      verifyAsync.mockResolvedValue(payload);
      getSessionStudent.mockResolvedValue({
        id: payload.sub,
        name: payload.name,
        email: payload.email,
      });
      const request = {
        cookies: { student_access_token: 'valid-token' },
      } as unknown as AuthenticatedStudentRequest;

      await expect(guard.canActivate(createContext(request))).resolves.toBe(
        true,
      );
      expect(request.studentUser).toEqual(payload);
    });

    it('rejects an HR token copied into the student cookie', async () => {
      verifyAsync.mockResolvedValue({ sub: 'hr-id', actor: 'hr' });
      const request = {
        cookies: { student_access_token: 'hr-token' },
      } as unknown as AuthenticatedStudentRequest;

      await expect(guard.canActivate(createContext(request))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a valid token after the student is soft deleted', async () => {
      verifyAsync.mockResolvedValue({
        sub: 'deleted-student-id',
        actor: 'student',
      });
      getSessionStudent.mockRejectedValue(new Error('soft deleted'));
      const request = {
        cookies: { student_access_token: 'previously-valid-token' },
      } as unknown as AuthenticatedStudentRequest;

      await expect(guard.canActivate(createContext(request))).rejects.toThrow(
        '登录已失效，请重新登录',
      );
    });
  });
});
