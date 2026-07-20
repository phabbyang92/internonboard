import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { SchemaTypes, Types } from 'mongoose';
import { WorkLocation } from '../../student/enums/student.enums';
import { WorkLocationAssignmentSource } from '../work-location-assignment-source.enum';

export type WorkLocationAssignmentDocument =
  HydratedDocument<WorkLocationAssignment>;

@Schema({
  collection: 'work_location_assignments',
  timestamps: true,
  versionKey: false,
})
export class WorkLocationAssignment {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Student',
    required: true,
    index: true,
  })
  studentId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(WorkLocation),
    required: true,
  })
  workLocation!: WorkLocation;

  // 该地点从什么时候开始对学生生效。
  @Prop({ type: Date, required: true, index: true })
  effectiveFrom!: Date;

  // null 表示这是学生当前或未来将生效的地点。
  @Prop({ type: Date, default: null, index: true })
  effectiveTo!: Date | null;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'HrUser',
    required: true,
  })
  changedByHrId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(WorkLocationAssignmentSource),
    required: true,
  })
  source!: WorkLocationAssignmentSource;

  createdAt!: Date;
  updatedAt!: Date;
}

export const WorkLocationAssignmentSchema = SchemaFactory.createForClass(
  WorkLocationAssignment,
);

WorkLocationAssignmentSchema.index({
  studentId: 1,
  effectiveFrom: -1,
});

// 每个学生同一时间只保留一条尚未结束的地点安排。
WorkLocationAssignmentSchema.index(
  { studentId: 1 },
  {
    unique: true,
    partialFilterExpression: { effectiveTo: null },
    name: 'unique_open_work_location_assignment',
  },
);
