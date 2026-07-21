import { StudentService } from '../student/student.service';
import { OnboardingStatusScheduler } from './onboarding-status.scheduler';

describe('OnboardingStatusScheduler', () => {
  it('delegates the daily job to the reusable student status updater', async () => {
    const studentService = {
      updateDueOnboardingStatuses: jest.fn().mockResolvedValue({
        matchedCount: 2,
        modifiedCount: 2,
        effectiveDate: new Date('2026-07-20T16:00:00.000Z'),
      }),
    };
    const scheduler = new OnboardingStatusScheduler(
      studentService as unknown as StudentService,
    );

    await scheduler.updateDueOnboardingStatuses();

    expect(studentService.updateDueOnboardingStatuses).toHaveBeenCalledTimes(1);
  });
});
