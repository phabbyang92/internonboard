import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { SchemaTypes, Types } from 'mongoose';
import { WorkLocation } from '../../student/enums/student.enums';
import { OFFICE_WORK_LOCATIONS } from '../attendance.constants';

export type OfficeNetworkDocument = HydratedDocument<OfficeNetwork>;

@Schema({
  collection: 'office_networks',
  timestamps: true,
  versionKey: false,
})
export class OfficeNetwork {
  @Prop({
    type: String,
    enum: OFFICE_WORK_LOCATIONS,
    required: true,
  })
  workLocation!: WorkLocation;

  @Prop({ type: [String], default: [] })
  cidrs!: string[];

  @Prop({ type: Boolean, default: true })
  enabled!: boolean;

  @Prop({ type: String, trim: true, default: null })
  description!: string | null;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'HrUser',
    required: true,
  })
  updatedByHrId!: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const OfficeNetworkSchema = SchemaFactory.createForClass(OfficeNetwork);

OfficeNetworkSchema.index(
  { workLocation: 1 },
  { unique: true, name: 'unique_office_network_work_location' },
);
OfficeNetworkSchema.index({ enabled: 1 });
