import { Injectable } from '@nestjs/common';
import { BusinessClockService } from '../../common/time/business-clock.service';
import { OnboardingStatus } from '../student/enums/student.enums';
import { StudentService } from '../student/student.service';
import { StudentPortalState } from './enums/student-portal-state.enum';
import type { StudentPortalResponse } from './interfaces/student-portal-response.interface';

@Injectable()
export class StudentPortalService {
  constructor(
    private readonly studentService: StudentService,
    private readonly businessClock: BusinessClockService,
  ) {}

  async getPortal(studentId: string): Promise<StudentPortalResponse> {
    const now = this.businessClock.now();

    // 每次进入工作台都先刷新状态，不能依赖 JWT 中登录时的旧状态。
    await this.studentService.updateDueOnboardingStatuses(now);
    const student = await this.studentService.findOneById(studentId);
    const today = this.businessClock.getBusinessDate(now);

    return {
      portalState: this.resolvePortalState(student, today),
      student: {
        id: student.id,
        name: student.name,
        onboardingStatus: student.onboardingStatus,
      },
    };
  }

  private resolvePortalState(
    student: Awaited<ReturnType<StudentService['findOneById']>>,
    today: string,
  ): StudentPortalState {
    const endDate = student.onboardingEndAt
      ? this.businessClock.getBusinessDate(student.onboardingEndAt)
      : null;

    if (
      student.onboardingStatus === OnboardingStatus.Departed ||
      (endDate !== null && today > endDate)
    ) {
      return StudentPortalState.Ended;
    }

    const startDate = student.onboardingStartAt
      ? this.businessClock.getBusinessDate(student.onboardingStartAt)
      : null;

    if (
      student.onboardingStatus === OnboardingStatus.Onboarded &&
      startDate !== null &&
      today >= startDate
    ) {
      return StudentPortalState.Attendance;
    }

    return student.hasSubmitted
      ? StudentPortalState.Waiting
      : StudentPortalState.Registration;
  }
}
