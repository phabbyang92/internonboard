import type { ApplicationDirection, StudentForm } from "@/types/student";

export interface StudentBasicInfoDraft {
  position: string;
  applicationDirection: ApplicationDirection | "";
  gender: string;
  birthDate: string;
  idNumber: string;
  householdRegistration: string;
  maritalStatus: string;
  currentSchool: string;
  major: string;
  degree: string;
  politicalStatus: string;
  sourceChannel: string;
  homeAddress: string;
  homePhone: string;
}

export interface EducationExperienceDraft {
  startYear: string;
  endYear: string;
  school: string;
  major: string;
  advisor: string;
  phone: string;
}

export interface FamilyMemberDraft {
  relation: string;
  name: string;
  employer: string;
  phone: string;
}

export interface InternshipExperienceDraft {
  startYear: string;
  endYear: string;
  company: string;
  referenceName: string;
  phone: string;
}

export interface StudentFormDraft {
  phone: string;
  basicInfo: StudentBasicInfoDraft;
  educationExperiences: EducationExperienceDraft[];
  familyMembers: FamilyMemberDraft[];
  internshipExperiences: InternshipExperienceDraft[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  // null 表示学生尚未选择，不能在页面加载时默认替学生回答“否”。
  hasIdCopyAndAgreement: boolean | null;
  notes: string;
  applicantSignature: string;
  applicantSignedAt: string;
  onboardingEndAt: string;
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  // API 日期是 ISO 字符串，date input 只需要 YYYY-MM-DD。
  return value.slice(0, 10);
}

const emptyEducationExperience: EducationExperienceDraft = {
  startYear: "",
  endYear: "",
  school: "",
  major: "",
  advisor: "",
  phone: "",
};

const emptyFamilyMember: FamilyMemberDraft = {
  relation: "",
  name: "",
  employer: "",
  phone: "",
};

export function createStudentFormDraft(form: StudentForm): StudentFormDraft {
  const basicInfo = form.basicInfo;

  return {
    phone: form.phone ?? "",
    basicInfo: {
      position: basicInfo?.position ?? "",
      applicationDirection: basicInfo?.applicationDirection ?? "",
      gender: basicInfo?.gender ?? "",
      birthDate: toDateInputValue(basicInfo?.birthDate),
      idNumber: basicInfo?.idNumber ?? "",
      householdRegistration: basicInfo?.householdRegistration ?? "",
      maritalStatus: basicInfo?.maritalStatus ?? "",
      currentSchool: basicInfo?.currentSchool ?? "",
      major: basicInfo?.major ?? "",
      degree: basicInfo?.degree ?? "",
      politicalStatus: basicInfo?.politicalStatus ?? "",
      sourceChannel: basicInfo?.sourceChannel ?? "",
      homeAddress: basicInfo?.homeAddress ?? "",
      homePhone: basicInfo?.homePhone ?? "",
    },
    educationExperiences: form.educationExperiences.length
      ? form.educationExperiences.map((experience) => ({
          ...experience,
          startYear: String(experience.startYear),
          endYear: String(experience.endYear),
          advisor: experience.advisor ?? "",
          phone: experience.phone ?? "",
        }))
      : [{ ...emptyEducationExperience }],
    familyMembers: form.familyMembers.length
      ? form.familyMembers.map((member) => ({
          ...member,
          employer: member.employer ?? "",
          phone: member.phone ?? "",
        }))
      : [{ ...emptyFamilyMember }],
    internshipExperiences: form.internshipExperiences.map((experience) => ({
      ...experience,
      startYear: String(experience.startYear),
      endYear: String(experience.endYear),
      referenceName: experience.referenceName ?? "",
      phone: experience.phone ?? "",
    })),
    emergencyContactName: form.emergencyContactName ?? "",
    emergencyContactPhone: form.emergencyContactPhone ?? "",
    emergencyContactRelation: form.emergencyContactRelation ?? "",
    hasIdCopyAndAgreement: form.hasIdCopyAndAgreement,
    notes: form.notes ?? "",
    applicantSignature: form.applicantSignature ?? "",
    applicantSignedAt: toDateInputValue(form.applicantSignedAt),
    onboardingEndAt: toDateInputValue(form.onboardingEndAt),
  };
}
