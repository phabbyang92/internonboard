import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WorkLocationAssignment,
  WorkLocationAssignmentSchema,
} from './schemas/work-location-assignment.schema';
import { WorkLocationHistoryService } from './work-location-history.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: WorkLocationAssignment.name,
        schema: WorkLocationAssignmentSchema,
      },
    ]),
  ],
  providers: [WorkLocationHistoryService],
  exports: [WorkLocationHistoryService],
})
export class WorkLocationHistoryModule {}
