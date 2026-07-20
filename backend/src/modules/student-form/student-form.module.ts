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

    // 提供 FILE_STORAGE，本地阶段对应 LocalFileStorageService。
    FileModule,
  ],
  controllers: [StudentFormController, StudentAttachmentController],
  providers: [StudentAttachmentService],
})
export class StudentFormModule {}
