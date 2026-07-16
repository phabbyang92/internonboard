import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { HrRole } from '../enums/hr-role.enum';

export type HrUserDocument = HydratedDocument<HrUser>;

@Schema({
  collection: 'hr_users',
  timestamps: true,
  versionKey: false,
})
export class HrUser {
  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
  })
  email!: string;

  @Prop({
    type: String,
    required: true,
    select: false,
  })
  passwordHash!: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  name!: string;

  @Prop({
    type: String,
    enum: Object.values(HrRole),
    default: HrRole.Hr,
  })
  role!: HrRole;

  @Prop({
    type: Date,
    default: null,
  })
  lastLoginAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const HrUserSchema = SchemaFactory.createForClass(HrUser);
