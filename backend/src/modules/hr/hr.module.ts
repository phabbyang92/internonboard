import { Module } from '@nestjs/common';
import { StudentModule } from '../student/student.module';
import { HrStudentsController } from './hr-students.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [StudentModule, AuthModule],
  controllers: [HrStudentsController],
})
export class HrModule {}
