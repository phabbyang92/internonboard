import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BusinessClockModule } from '../../common/time/business-clock.module';
import { HrUser, HrUserSchema } from '../auth/schemas/hr-user.schema';
import { AuthModule } from '../auth/auth.module';
import { OperationLogModule } from '../operation-log/operation-log.module';
import { StudentModule } from '../student/student.module';
import {
  WorkLocationAssignment,
  WorkLocationAssignmentSchema,
} from '../work-location/schemas/work-location-assignment.schema';
import { HrAttendanceAccessService } from './access/hr-attendance-access.service';
import { RegionAccessService } from './access/region-access.service';
import { AdminAttendanceSettingsController } from './admin-attendance-settings.controller';
import { AttendanceCalendarManagementService } from './attendance-calendar-management.service';
import { AttendanceCalendarService } from './attendance-calendar.service';
import { AttendanceCheckInService } from './attendance-check-in.service';
import { AttendanceCheckInPolicyService } from './attendance-check-in-policy.service';
import { AttendanceDeviceService } from './attendance-device.service';
import { AttendanceEligibilityService } from './attendance-eligibility.service';
import { AttendanceLocationService } from './attendance-location.service';
import { AttendanceQueryPreparationService } from './attendance-query-preparation.service';
import { AttendanceReconciliationService } from './attendance-reconciliation.service';
import { AttendanceLeaveCancellationService } from './attendance-leave-cancellation.service';
import { AttendanceLeavePolicyService } from './attendance-leave-policy.service';
import { AttendanceLeaveOptionsService } from './attendance-leave-options.service';
import { AttendanceLeaveRegistrationService } from './attendance-leave-registration.service';
import { HrAttendanceController } from './hr-attendance.controller';
import { HrAttendanceCorrectionService } from './hr-attendance-correction.service';
import { HrRegionManagementController } from './hr-region-management.controller';
import { HrRegionManagementService } from './hr-region-management.service';
import { HrAttendanceSummaryService } from './hr-attendance-summary.service';
import { HrDailyAttendanceService } from './hr-daily-attendance.service';
import { HrStudentAttendanceService } from './hr-student-attendance.service';
import { OfficeNetworkService } from './office-network.service';
import { OfficeNetworkManagementController } from './office-network-management.controller';
import { OfficeNetworkManagementService } from './office-network-management.service';
import {
  AttendanceCalendar,
  AttendanceCalendarSchema,
} from './schemas/attendance-calendar.schema';
import {
  AttendanceRecord,
  AttendanceRecordSchema,
} from './schemas/attendance-record.schema';
import {
  OfficeNetwork,
  OfficeNetworkSchema,
} from './schemas/office-network.schema';
import { AttendanceAbsenceScheduler } from './schedulers/attendance-absence.scheduler';
import { AttendanceOperationsController } from './attendance-operations.controller';
import { StudentAttendanceController } from './student-attendance.controller';
import { StudentAttendanceReadService } from './student-attendance-read.service';
import { StudentPortalController } from './student-portal.controller';
import { StudentPortalService } from './student-portal.service';
import { ObservabilityModule } from '../../common/observability/observability.module';

@Module({
  imports: [
    AuthModule,
    ObservabilityModule,
    OperationLogModule,
    BusinessClockModule,
    StudentModule,
    MongooseModule.forFeature([
      { name: AttendanceRecord.name, schema: AttendanceRecordSchema },
      { name: AttendanceCalendar.name, schema: AttendanceCalendarSchema },
      { name: OfficeNetwork.name, schema: OfficeNetworkSchema },
      { name: HrUser.name, schema: HrUserSchema },
      {
        name: WorkLocationAssignment.name,
        schema: WorkLocationAssignmentSchema,
      },
    ]),
  ],
  controllers: [
    StudentAttendanceController,
    StudentPortalController,
    AdminAttendanceSettingsController,
    HrRegionManagementController,
    OfficeNetworkManagementController,
    HrAttendanceController,
    AttendanceOperationsController,
  ],
  providers: [
    HrAttendanceAccessService,
    HrAttendanceCorrectionService,
    HrAttendanceSummaryService,
    HrDailyAttendanceService,
    HrStudentAttendanceService,
    HrRegionManagementService,
    RegionAccessService,
    AttendanceCalendarManagementService,
    AttendanceCalendarService,
    AttendanceCheckInService,
    AttendanceCheckInPolicyService,
    AttendanceDeviceService,
    AttendanceLocationService,
    AttendanceQueryPreparationService,
    AttendanceReconciliationService,
    AttendanceLeaveCancellationService,
    AttendanceLeaveOptionsService,
    AttendanceLeavePolicyService,
    AttendanceLeaveRegistrationService,
    AttendanceEligibilityService,
    StudentAttendanceReadService,
    StudentPortalService,
    OfficeNetworkService,
    OfficeNetworkManagementService,
    AttendanceAbsenceScheduler,
  ],
  exports: [
    HrAttendanceAccessService,
    HrAttendanceCorrectionService,
    HrAttendanceSummaryService,
    HrDailyAttendanceService,
    HrStudentAttendanceService,
    RegionAccessService,
    AttendanceCalendarManagementService,
    AttendanceCalendarService,
    AttendanceCheckInService,
    AttendanceCheckInPolicyService,
    AttendanceDeviceService,
    AttendanceLocationService,
    AttendanceQueryPreparationService,
    AttendanceReconciliationService,
    AttendanceLeaveCancellationService,
    AttendanceLeaveOptionsService,
    AttendanceLeavePolicyService,
    AttendanceLeaveRegistrationService,
    AttendanceEligibilityService,
    StudentAttendanceReadService,
    StudentPortalService,
    OfficeNetworkService,
  ],
})
export class AttendanceModule {}
