import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { StudentService } from '../student/student.service';
import { OnboardingStatus } from '../student/enums/student.enums';
import { StudentLoginDto } from './dto/student-login.dto';
import { JwtService } from '@nestjs/jwt';
import type { StudentJwtPayload } from './interfaces/student-jwt-payload.interface';

@Injectable()
export class StudentAuthService {
  constructor(
    private readonly studentService: StudentService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: StudentLoginDto) {
    const student = await this.validateLogin(dto);

    const payload: StudentJwtPayload = {
      sub: student.id,
      actor: 'student',
      name: student.name,
      email: student.email,
    };

    // JWT 只保存识别登录者所需的稳定信息。
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      student,
    };
  }

  async getCurrentStudent(studentId: string) {
    // 每次从数据库读取，避免只使用 JWT 中可能过时的信息。
    return this.studentService.findOneById(studentId);
  }

  async validateLogin(dto: StudentLoginDto) {
    const student = await this.studentService.findByLoginIdentity(
      dto.name,
      dto.email,
    );

    if (!student) {
      // Use one generic message instead of revealing which field was wrong.
      throw new UnauthorizedException('姓名或邮箱不正确，或未在入职名单中');
    }

    const hasCompletedArrangement =
      student.onboardingStatus !== OnboardingStatus.Candidate &&
      Boolean(student.workLocation) &&
      Boolean(student.onboardingStartAt);

    if (!hasCompletedArrangement) {
      throw new ForbiddenException('入职安排尚未完成，请联系 HR');
    }

    // submittedAt does not prevent login. It will make the form read-only later.
    return {
      id: student._id.toString(),
      name: student.name,
      email: student.email,
      onboardingStatus: student.onboardingStatus,
      workLocation: student.workLocation,
      onboardingStartAt: student.onboardingStartAt,
      submittedAt: student.submittedAt ?? null,
      hasSubmitted: Boolean(student.submittedAt),
      // 提交后仍然允许登录，但只能查看，不能继续编辑。
      canEdit: !student.submittedAt,
    };
  }
}
