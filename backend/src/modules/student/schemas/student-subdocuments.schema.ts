import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AttachmentType } from '../enums/student.enums';

@Schema({ _id: false })
export class BasicInfo {
  @Prop({ trim: true })
  position?: string;

  @Prop({ type: Date })
  formDate?: Date;

  @Prop({ trim: true })
  gender?: string;

  @Prop({ type: Date })
  birthDate?: Date;

  @Prop({ trim: true })
  idNumber?: string;

  @Prop({ trim: true })
  householdRegistration?: string;

  @Prop({ trim: true })
  maritalStatus?: string;

  @Prop({ trim: true })
  currentSchool?: string;

  @Prop({ trim: true })
  major?: string;

  @Prop({ trim: true })
  degree?: string;

  @Prop({ trim: true })
  politicalStatus?: string;

  @Prop({ trim: true })
  sourceChannel?: string;

  @Prop({ trim: true })
  homeAddress?: string;

  @Prop({ trim: true })
  homePhone?: string;
}

export const BasicInfoSchema = SchemaFactory.createForClass(BasicInfo);

@Schema({ _id: false })
export class EducationExperience {
  @Prop({ type: Number })
  startYear?: number;

  @Prop({ type: Number })
  endYear?: number;

  @Prop({ trim: true })
  school?: string;

  @Prop({ trim: true })
  major?: string;

  @Prop({ trim: true })
  advisor?: string;

  @Prop({ trim: true })
  phone?: string;
}

export const EducationExperienceSchema =
  SchemaFactory.createForClass(EducationExperience);

@Schema({ _id: false })
export class FamilyMember {
  @Prop({ trim: true })
  relation?: string;

  @Prop({ trim: true })
  name?: string;

  @Prop({ trim: true })
  employer?: string;

  @Prop({ trim: true })
  phone?: string;
}

export const FamilyMemberSchema = SchemaFactory.createForClass(FamilyMember);

@Schema({ _id: false })
export class InternshipExperience {
  @Prop({ type: Number })
  startYear?: number;

  @Prop({ type: Number })
  endYear?: number;

  @Prop({ trim: true })
  company?: string;

  @Prop({ trim: true })
  referenceName?: string;

  @Prop({ trim: true })
  phone?: string;
}

export const InternshipExperienceSchema =
  SchemaFactory.createForClass(InternshipExperience);

@Schema({ _id: false })
export class Attachment {
  @Prop({
    type: String,
    enum: Object.values(AttachmentType),
    required: true,
  })
  type!: AttachmentType;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  originalName!: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  storageKey!: string;
}

export const AttachmentSchema = SchemaFactory.createForClass(Attachment);
