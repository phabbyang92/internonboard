import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FileModule } from '../file/file.module';
import { OperationLogModule } from '../operation-log/operation-log.module';
import { StudentModule } from '../student/student.module';
import { WorkLocationHistoryModule } from '../work-location/work-location-history.module';
import { HrAttachmentController } from './hr-attachment.controller';
import { HrAttachmentService } from './hr-attachment.service';
import { HrStudentManagementService } from './hr-student-management.service';
import { HrStudentsController } from './hr-students.controller';

@Module({
  imports: [
    StudentModule,
    AuthModule,
    FileModule,
    OperationLogModule,
    WorkLocationHistoryModule,
  ],
  controllers: [HrStudentsController, HrAttachmentController],
  providers: [HrAttachmentService, HrStudentManagementService],
})
export class HrModule {}
