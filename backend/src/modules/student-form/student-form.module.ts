import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudentModule } from '../student/student.module';
import { StudentFormController } from './student-form.controller';
import { FileModule } from '../file/file.module';
import { StudentAttachmentService } from './student-attachment.service';
import { StudentAttachmentController } from './student-attachment.controller';

@Module({
  imports: [
    AuthModule,
    StudentModule,

    // 根据 FILE_STORAGE_DRIVER 提供本地或 ownCloud 存储实现。
    FileModule,
  ],
  controllers: [StudentFormController, StudentAttachmentController],
  providers: [StudentAttachmentService],
})
export class StudentFormModule {}
