import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { BaseSchema } from '../../../common/schemas/base.schema';
import { OnboardingStatus } from '../enums/student.enums';
import {
  Attachment,
  AttachmentSchema,
  BasicInfo,
  BasicInfoSchema,
  EducationExperience,
  EducationExperienceSchema,
  FamilyMember,
  FamilyMemberSchema,
  InternshipExperience,
  InternshipExperienceSchema,
} from './student-subdocuments.schema';

export type StudentDocument = HydratedDocument<Student>;

@Schema({
  collection: 'students',
  timestamps: true,
  versionKey: false,
})
export class Student extends BaseSchema {
  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  })
  email!: string;

  @Prop({ type: String, trim: true, index: true })
  phone?: string;

  @Prop({
    type: String,
    enum: Object.values(OnboardingStatus),
    default: OnboardingStatus.Candidate,
    index: true,
  })
  onboardingStatus!: OnboardingStatus;

  @Prop({ type: BasicInfoSchema, default: null })
  basicInfo?: BasicInfo | null;

  @Prop({ type: [EducationExperienceSchema], default: [] })
  educationExperiences!: EducationExperience[];

  @Prop({ type: [FamilyMemberSchema], default: [] })
  familyMembers!: FamilyMember[];

  @Prop({ type: [InternshipExperienceSchema], default: [] })
  internshipExperiences!: InternshipExperience[];

  @Prop({ type: String, trim: true })
  emergencyContactName?: string;

  @Prop({ type: String, trim: true })
  emergencyContactPhone?: string;

  @Prop({ type: String, trim: true })
  emergencyContactRelation?: string;

  @Prop({ type: Boolean })
  hasIdCopyAndAgreement?: boolean;

  @Prop({ type: Date, default: null })
  agreementSignedAt?: Date | null;

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: String, trim: true })
  applicantSignature?: string;

  @Prop({ type: Date, default: null })
  applicantSignedAt?: Date | null;

  @Prop({ type: [AttachmentSchema], default: [] })
  attachments!: Attachment[];

  @Prop({ type: Date, default: null })
  onboardingStartAt?: Date | null;

  @Prop({ type: Date, default: null })
  onboardingEndAt?: Date | null;

  @Prop({ type: String, trim: true })
  workLocation?: string;

  @Prop({ type: Date, default: null })
  submittedAt?: Date | null;
}

export const StudentSchema = SchemaFactory.createForClass(Student);

StudentSchema.index(
  { name: 1, email: 1 },
  {
    unique: true,
    name: 'unique_student_name_email',
  },
);
