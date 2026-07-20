import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { SchemaTypes, Types } from 'mongoose';
import { OperationAction } from '../enums/operation-action.enum';

export type OperationLogDocument = HydratedDocument<OperationLog>;

@Schema({
  collection: 'operation_logs',

  // 操作日志只追加、不修改，因此不需要 updatedAt。
  timestamps: {
    createdAt: true,
    updatedAt: false,
  },
  versionKey: false,
})
export class OperationLog {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'HrUser',
    required: true,
    index: true,
  })
  operatorHrId!: Types.ObjectId;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Student',
    required: true,
    index: true,
  })
  studentId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(OperationAction),
    required: true,
    index: true,
  })
  action!: OperationAction;

  // 保存必要的新旧值或被修改字段，不保存完整身份证等敏感资料。
  @Prop({
    type: SchemaTypes.Mixed,
    default: null,
  })
  changes!: Record<string, unknown> | null;

  createdAt!: Date;
}

export const OperationLogSchema = SchemaFactory.createForClass(OperationLog);

OperationLogSchema.index({
  studentId: 1,
  createdAt: -1,
});
