import type { Request } from 'express';
import type { StudentJwtPayload } from './student-jwt-payload.interface';

export interface AuthenticatedStudentRequest extends Request {
  // StudentAuthGuard 验证 JWT 后，会把学生身份放到这里。
  studentUser: StudentJwtPayload;
}
