export const ONBOARDING_STATUSES = [
  "candidate",
  "pending_onboarding",
  "onboarded",
  "departed",
] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const APPLICATION_DIRECTIONS = ["咨询", "新媒体", "ai"] as const;

export type ApplicationDirection = (typeof APPLICATION_DIRECTIONS)[number];

export const WORK_LOCATIONS = [
  "北京办公室",
  "香港办公室",
  "深圳办公室",
  "深圳研究院",
  "上海办公室",
  "上海研究院",
  "南京办公室",
  "线上",
] as const;

export type WorkLocation = (typeof WORK_LOCATIONS)[number];

export const ATTACHMENT_TYPES = [
  "resume",
  "id_card_front",
  "id_card_back",
] as const;

export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

export interface AttachmentMetadata {
  type: AttachmentType;
  originalName: string;
  storageKey: string;
}

export interface StudentBasicInfo {
  position: string;
  applicationDirection: ApplicationDirection;
  formDate?: string | null;
  gender: string;
  birthDate: string;
  idNumber: string;
  householdRegistration: string;
  maritalStatus?: string;
  currentSchool: string;
  major: string;
  degree: string;
  politicalStatus?: string;
  sourceChannel: string;
  homeAddress: string;
  homePhone?: string;
}

export interface EducationExperience {
  startYear: number;
  endYear: number;
  school: string;
  major: string;
  advisor?: string;
  phone?: string;
}

export interface FamilyMember {
  relation: string;
  name: string;
  employer?: string;
  phone?: string;
}

export interface InternshipExperience {
  startYear: number;
  endYear: number;
  company: string;
  referenceName?: string;
  phone?: string;
}

export interface StudentSession {
  id: string;
  name: string;
  email: string;
  onboardingStatus: OnboardingStatus;
  workLocation: WorkLocation;
  onboardingStartAt: string;
  submittedAt: string | null;
  hasSubmitted: boolean;
  canEdit: boolean;
}

export interface StudentForm {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  onboardingStatus: OnboardingStatus;

  basicInfo: StudentBasicInfo | null;
  educationExperiences: EducationExperience[];
  familyMembers: FamilyMember[];
  internshipExperiences: InternshipExperience[];

  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;

  hasIdCopyAndAgreement: boolean | null;
  agreementSignedAt: string | null;
  notes: string | null;
  applicantSignature: string | null;
  applicantSignedAt: string | null;

  attachments: AttachmentMetadata[];

  workLocation: WorkLocation | null;
  onboardingStartAt: string | null;
  onboardingEndAt: string | null;

  submittedAt: string | null;
  hasSubmitted: boolean;
  canEdit: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface StudentLoginPayload {
  name: string;
  email: string;
}

export interface StudentLoginResponse {
  student: StudentSession;
}

export interface StudentMeResponse {
  student: StudentSession;
}

export interface StudentFormResponse {
  form: StudentForm;
}

export interface SubmitStudentFormPayload {
  phone: string;
  basicInfo: StudentBasicInfo;
  educationExperiences: EducationExperience[];
  familyMembers: FamilyMember[];
  internshipExperiences: InternshipExperience[];

  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;

  hasIdCopyAndAgreement: boolean;
  notes?: string;

  applicantSignature: string;
  applicantSignedAt: string;
  onboardingEndAt: string;
}

export interface SubmitStudentFormResponse {
  message: string;
  studentId: string;
  submittedAt: string;
  hasSubmitted: true;
  canEdit: false;
}

export interface AttachmentMutationResponse {
  message: string;
  attachment: AttachmentMetadata;
}
