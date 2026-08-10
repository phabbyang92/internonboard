import type { BusinessClockService } from '../../common/time/business-clock.service';
import { OnboardingStatus } from '../student/enums/student.enums';
import type { StudentService } from '../student/student.service';
import { StudentPortalState } from './enums/student-portal-state.enum';
import { StudentPortalService } from './student-portal.service';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const NOW = new Date('2026-08-06T04:00:00.000Z');

function createService(studentOverrides: Record<string, unknown> = {}) {
  const student = {
    id: STUDENT_ID,
    name: '测试学生',
    onboardingStatus: OnboardingStatus.PendingOnboarding,
    onboardingStartAt: new Date('2026-08-10T00:00:00+08:00'),
    onboardingEndAt: new Date('2026-08-31T00:00:00+08:00'),
    hasSubmitted: false,
    ...studentOverrides,
  };
  const studentService = {
    updateDueOnboardingStatuses: jest.fn().mockResolvedValue({}),
    findOneById: jest.fn().mockResolvedValue(student),
  };
  const businessClock = {
    now: jest.fn().mockReturnValue(NOW),
    getBusinessDate: jest.fn((date: Date) => {
      const chinaTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);

      return chinaTime.toISOString().slice(0, 10);
    }),
  };

  return {
    studentService,
    service: new StudentPortalService(
      studentService as unknown as StudentService,
      businessClock as unknown as BusinessClockService,
    ),
  };
}

describe('StudentPortalService', () => {
  it('routes an unsubmitted student to registration before internship', async () => {
    const { service, studentService } = createService();

    await expect(service.getPortal(STUDENT_ID)).resolves.toMatchObject({
      portalState: StudentPortalState.Registration,
      student: { id: STUDENT_ID, name: '测试学生' },
    });
    expect(studentService.updateDueOnboardingStatuses).toHaveBeenCalledWith(
      NOW,
    );
  });

  it('routes a submitted student to the waiting page before internship', async () => {
    const { service } = createService({ hasSubmitted: true });

    await expect(service.getPortal(STUDENT_ID)).resolves.toMatchObject({
      portalState: StudentPortalState.Waiting,
    });
  });

  it('routes an onboarded student to attendance from the start date through the end date', async () => {
    const { service } = createService({
      onboardingStatus: OnboardingStatus.Onboarded,
      onboardingStartAt: new Date('2026-08-01T00:00:00+08:00'),
      onboardingEndAt: new Date('2026-08-06T00:00:00+08:00'),
      hasSubmitted: true,
    });

    await expect(service.getPortal(STUDENT_ID)).resolves.toMatchObject({
      portalState: StudentPortalState.Attendance,
    });
  });

  it('routes a departed student to the ended page', async () => {
    const { service } = createService({
      onboardingStatus: OnboardingStatus.Departed,
      hasSubmitted: true,
    });

    await expect(service.getPortal(STUDENT_ID)).resolves.toMatchObject({
      portalState: StudentPortalState.Ended,
    });
  });
});
