import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  OperationLog,
  OperationLogSchema,
} from './schemas/operation-log.schema';
import { OperationLogService } from './operation-log.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: OperationLog.name,
        schema: OperationLogSchema,
      },
    ]),
  ],
  providers: [OperationLogService],
  exports: [OperationLogService],
})
export class OperationLogModule {}
