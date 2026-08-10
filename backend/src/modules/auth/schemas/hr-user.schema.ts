import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { RegionCode } from '../../attendance/enums/region-code.enum';
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

  // 学生可见范围仍由 ownerHrId 决定；该字段只控制地区配置权限。
  @Prop({
    type: [String],
    enum: Object.values(RegionCode),
    default: [],
    index: true,
  })
  managedRegionCodes!: RegionCode[];

  @Prop({
    type: Date,
    default: null,
  })
  lastLoginAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const HrUserSchema = SchemaFactory.createForClass(HrUser);
