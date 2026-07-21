import type {
  ApplicationDirection,
  SubmitStudentFormPayload,
} from "@/types/student";
import type { StudentFormDraft } from "@/types/student-form-draft";

function optionalString(value: string) {
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}

function dateInputToIso(value: string) {
  // Date inputs represent calendar dates, so serialize at UTC midnight.
  return `${value}T00:00:00.000Z`;
}

export function buildStudentFormPayload(
  draft: StudentFormDraft,
): SubmitStudentFormPayload {
  if (
    draft.basicInfo.applicationDirection === "" ||
    draft.hasIdCopyAndAgreement === null
  ) {
    throw new Error("登记表仍有必填内容未完成");
  }

  return {
    phone: draft.phone.trim(),
    basicInfo: {
      position: draft.basicInfo.position.trim(),
      applicationDirection: draft.basicInfo
        .applicationDirection as ApplicationDirection,
      birthDate: dateInputToIso(draft.basicInfo.birthDate),
      gender: draft.basicInfo.gender.trim(),
      idNumber: draft.basicInfo.idNumber.trim(),
      householdRegistration:
        draft.basicInfo.householdRegistration.trim(),
      maritalStatus: optionalString(draft.basicInfo.maritalStatus),
      currentSchool: draft.basicInfo.currentSchool.trim(),
      major: draft.basicInfo.major.trim(),
      degree: draft.basicInfo.degree.trim(),
      politicalStatus: optionalString(draft.basicInfo.politicalStatus),
      sourceChannel: optionalString(draft.basicInfo.sourceChannel),
      homeAddress: draft.basicInfo.homeAddress.trim(),
      homePhone: optionalString(draft.basicInfo.homePhone),
    },
    educationExperiences: draft.educationExperiences.map((experience) => ({
      startYear: Number(experience.startYear),
      endYear: Number(experience.endYear),
      school: experience.school.trim(),
      major: experience.major.trim(),
      advisor: optionalString(experience.advisor),
      phone: optionalString(experience.phone),
    })),
    familyMembers: draft.familyMembers.map((member) => ({
      relation: member.relation.trim(),
      name: member.name.trim(),
      employer: optionalString(member.employer),
      phone: optionalString(member.phone),
    })),
    internshipExperiences: draft.internshipExperiences.map((experience) => ({
      startYear: Number(experience.startYear),
      endYear: Number(experience.endYear),
      company: experience.company.trim(),
      referenceName: optionalString(experience.referenceName),
      phone: optionalString(experience.phone),
    })),
    emergencyContactName: draft.emergencyContactName.trim(),
    emergencyContactPhone: draft.emergencyContactPhone.trim(),
    emergencyContactRelation: draft.emergencyContactRelation.trim(),
    hasIdCopyAndAgreement: draft.hasIdCopyAndAgreement,
    agreementSignedAt:
      draft.hasIdCopyAndAgreement && draft.agreementSignedAt
        ? dateInputToIso(draft.agreementSignedAt)
        : undefined,
    notes: optionalString(draft.notes),
    applicantSignature: draft.applicantSignature.trim(),
    applicantSignedAt: dateInputToIso(draft.applicantSignedAt),
    onboardingEndAt: dateInputToIso(draft.onboardingEndAt),
  };
}

export function findIncompleteRequiredField(
  draft: StudentFormDraft,
): string | null {
  const requiredFields: Array<[label: string, value: string]> = [
    ["联系电话", draft.phone],
    ["申请职位", draft.basicInfo.position],
    ["性别", draft.basicInfo.gender],
    ["出生日期", draft.basicInfo.birthDate],
    ["身份证件号码", draft.basicInfo.idNumber],
    ["户籍", draft.basicInfo.householdRegistration],
    ["在读学校", draft.basicInfo.currentSchool],
    ["专业", draft.basicInfo.major],
    ["学历", draft.basicInfo.degree],
    ["家庭地址", draft.basicInfo.homeAddress],
    ["实习结束日期", draft.onboardingEndAt],
    ["紧急联系人姓名", draft.emergencyContactName],
    ["紧急联系人电话", draft.emergencyContactPhone],
    ["与紧急联系人的关系", draft.emergencyContactRelation],
    ["申请人签名", draft.applicantSignature],
    ["签署日期", draft.applicantSignedAt],
  ];

  for (const [index, experience] of draft.educationExperiences.entries()) {
    requiredFields.push(
      [`教育经历 ${index + 1} 的起始年份`, experience.startYear],
      [`教育经历 ${index + 1} 的结束年份`, experience.endYear],
      [`教育经历 ${index + 1} 的学校`, experience.school],
      [`教育经历 ${index + 1} 的专业`, experience.major],
    );
  }

  for (const [index, member] of draft.familyMembers.entries()) {
    requiredFields.push(
      [`家庭成员 ${index + 1} 的关系`, member.relation],
      [`家庭成员 ${index + 1} 的姓名`, member.name],
    );
  }

  for (const [index, experience] of draft.internshipExperiences.entries()) {
    requiredFields.push(
      [`实习经历 ${index + 1} 的起始年份`, experience.startYear],
      [`实习经历 ${index + 1} 的结束年份`, experience.endYear],
      [`实习经历 ${index + 1} 的公司`, experience.company],
    );
  }

  if (draft.hasIdCopyAndAgreement === true) {
    requiredFields.push(["服务协议签署日期", draft.agreementSignedAt]);
  }

  const incompleteField = requiredFields.find(
    ([, value]) => value.trim() === "",
  );

  return incompleteField?.[0] ?? null;
}
