import { Module } from '@nestjs/common';
import { StudentModule } from '../student/student.module';
import { OnboardingStatusScheduler } from './onboarding-status.scheduler';
import { WorkLocationHistoryModule } from '../work-location/work-location-history.module';

@Module({
  imports: [StudentModule, WorkLocationHistoryModule],
  providers: [OnboardingStatusScheduler],
})
export class OnboardingModule {}
