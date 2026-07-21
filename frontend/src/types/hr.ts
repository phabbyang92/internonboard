import type {
  AttachmentMetadata,
  EducationExperience,
  FamilyMember,
  InternshipExperience,
  OnboardingStatus,
  StudentBasicInfo,
  StudentForm,
  WorkLocation,
} from "@/types/student";

export type HrRole = "admin" | "hr";

export interface HrUser {
  id: string;
  email: string;
  name: string;
  role: HrRole;
}

export interface HrLoginPayload {
  email: string;
  password: string;
}

export interface HrLoginResponse {
  user: HrUser;
}

export interface HrMeResponse {
  user: HrUser;
}

export interface HrStudentListItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  onboardingStatus: OnboardingStatus;
  workLocation: WorkLocation | null;
  onboardingStartAt: string | null;
  onboardingEndAt: string | null;
  submittedAt: string | null;
  createdAt: string;
}

export interface HrStudentListQuery {
  page?: number;
  limit?: number;
  keyword?: string;
  status?: OnboardingStatus | "";
}

export interface HrStudentListResponse {
  items: HrStudentListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateHrStudentPayload {
  name: string;
  email: string;
  phone?: string;
}

export interface CreateHrStudentResponse {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  onboardingStatus: OnboardingStatus;
  createdAt: string;
}

export interface UpdateHrArrangementPayload {
  workLocation?: WorkLocation;
  onboardingStartAt?: string;
  onboardingEndAt?: string;
}

export interface BatchUpdateHrArrangementPayload {
  studentIds: string[];
  workLocation: WorkLocation;
  onboardingStartAt: string;
}

export interface UpdateHrProfilePayload {
  name?: string;
  email?: string;
  phone?: string;
  basicInfo?: Partial<StudentBasicInfo>;
  educationExperiences?: EducationExperience[];
  familyMembers?: FamilyMember[];
  internshipExperiences?: InternshipExperience[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  hasIdCopyAndAgreement?: boolean;
  agreementSignedAt?: string | null;
  notes?: string;
  applicantSignature?: string;
  applicantSignedAt?: string | null;
}

export type HrStudentDetail = StudentForm;

export interface WorkLocationHistoryItem {
  id: string;
  studentId: string;
  workLocation: WorkLocation;
  effectiveFrom: string;
  effectiveTo: string | null;
  changedByHrId: string;
  source: "backfill" | "single" | "batch";
  createdAt: string;
  updatedAt: string;
}

export interface WorkLocationHistoryResponse {
  items: WorkLocationHistoryItem[];
}

export type OperationAction =
  | "student.created"
  | "student.profile.updated"
  | "student.arrangement.updated"
  | "student.attachment.uploaded"
  | "student.attachment.replaced"
  | "student.attachment.deleted"
  | "student.soft_deleted";

export interface OperationLogItem {
  id: string;
  operatorHrId: string;
  studentId: string;
  action: OperationAction;
  changes: Record<string, unknown> | null;
  createdAt: string;
}

export interface OperationLogResponse {
  items: OperationLogItem[];
  pagination: HrStudentListResponse["pagination"];
}

export interface AttachmentMutationResult {
  message: string;
  attachment: AttachmentMetadata;
}
