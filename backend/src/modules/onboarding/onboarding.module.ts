import { Module } from '@nestjs/common';
import { StudentModule } from '../student/student.module';
import { OnboardingStatusScheduler } from './onboarding-status.scheduler';

@Module({
  imports: [StudentModule],
  providers: [OnboardingStatusScheduler],
})
export class OnboardingModule {}
