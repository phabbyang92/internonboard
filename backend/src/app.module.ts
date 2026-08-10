import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { FileModule } from './modules/file/file.module';
import { HrModule } from './modules/hr/hr.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { StudentFormModule } from './modules/student-form/student-form.module';
import { StudentModule } from './modules/student/student.module';
import { BusinessClockModule } from './common/time/business-clock.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { validateEnvironment } from './config/environment.validation';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './modules/health/health.module';
import { ObservabilityModule } from './common/observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        limit: 60,
        ttl: 60_000,
        blockDuration: 60_000,
      },
    ]),
    ScheduleModule.forRoot(),
    ObservabilityModule,
    BusinessClockModule,
    DatabaseModule,
    HealthModule,
    AttendanceModule,
    StudentModule,
    HrModule,
    AuthModule,
    FileModule,
    OnboardingModule,
    StudentFormModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
