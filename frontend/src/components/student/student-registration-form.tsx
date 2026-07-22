"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { AttachmentsSection } from "@/components/student/attachments-section";
import { FamilyMembersSection } from "@/components/student/family-members-section";
import { FormField } from "@/components/student/form-field";
import {
  addButtonClassName,
  inputClassName,
  primaryButtonClassName,
  removeButtonClassName,
} from "@/components/student/form-control-styles";
import { InternshipExperiencesSection } from "@/components/student/internship-experiences-section";
import { StudentFormSubmitSection } from "@/components/student/student-form-submit-section";
import { SupplementaryInfoSection } from "@/components/student/supplementary-info-section";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { ApiError } from "@/lib/api/client";
import { submitStudentForm } from "@/lib/api/student-form";
import {
  buildStudentFormPayload,
  findIncompleteRequiredField,
} from "@/lib/student-form-payload";
import { APPLICATION_DIRECTIONS, type StudentForm } from "@/types/student";
import {
  createStudentFormDraft,
  type StudentBasicInfoDraft,
  type EducationExperienceDraft,
  type FamilyMemberDraft,
  type InternshipExperienceDraft,
} from "@/types/student-form-draft";

interface StudentRegistrationFormProps {
  form: StudentForm;
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

const emptyInternshipExperience: InternshipExperienceDraft = {
  startYear: "",
  endYear: "",
  company: "",
  referenceName: "",
  phone: "",
};

export function StudentRegistrationForm({ form }: StudentRegistrationFormProps) {
  const router = useRouter();

  // 只在本组件第一次挂载时读取 API 数据，之后每次输入都保留在草稿中。
  const [draft, setDraft] = useState(() => createStudentFormDraft(form));
  const [attachments, setAttachments] = useState(form.attachments);
  const [isAttachmentBusy, setIsAttachmentBusy] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function updateBasicInfo<Key extends keyof StudentBasicInfoDraft>(
    key: Key,
    value: StudentBasicInfoDraft[Key],
  ) {
    setDraft((current) => ({
      ...current,
      basicInfo: {
        ...current.basicInfo,
        [key]: value,
      },
    }));
  }

  function addEducationExperience() {
    setDraft((current) => {
      if (current.educationExperiences.length >= 10) {
        return current;
      }

      return {
        ...current,
        // 创建新对象，避免不同经历意外共享同一份数据。
        educationExperiences: [
          ...current.educationExperiences,
          { ...emptyEducationExperience },
        ],
      };
    });
  }

  function updateEducationExperience<
    Key extends keyof EducationExperienceDraft,
  >(
    index: number,
    key: Key,
    value: EducationExperienceDraft[Key],
  ) {
    setDraft((current) => ({
      ...current,
      educationExperiences: current.educationExperiences.map(
        (experience, experienceIndex) =>
          experienceIndex === index
            ? { ...experience, [key]: value }
            : experience,
      ),
    }));
  }

  function removeEducationExperience(index: number) {
    setDraft((current) => ({
      ...current,
      educationExperiences: current.educationExperiences.filter(
        (_, experienceIndex) => experienceIndex !== index,
      ),
    }));
  }

  function addFamilyMember() {
    setDraft((current) =>
      current.familyMembers.length >= 10
        ? current
        : {
            ...current,
            familyMembers: [
              ...current.familyMembers,
              { ...emptyFamilyMember },
            ],
          },
    );
  }

  function updateFamilyMember<Key extends keyof FamilyMemberDraft>(
    index: number,
    key: Key,
    value: FamilyMemberDraft[Key],
  ) {
    setDraft((current) => ({
      ...current,
      familyMembers: current.familyMembers.map((member, memberIndex) =>
        memberIndex === index ? { ...member, [key]: value } : member,
      ),
    }));
  }

  function removeFamilyMember(index: number) {
    setDraft((current) => ({
      ...current,
      familyMembers: current.familyMembers.filter(
        (_, memberIndex) => memberIndex !== index,
      ),
    }));
  }

  function addInternshipExperience() {
    setDraft((current) =>
      current.internshipExperiences.length >= 20
        ? current
        : {
            ...current,
            internshipExperiences: [
              ...current.internshipExperiences,
              { ...emptyInternshipExperience },
            ],
          },
    );
  }

  function updateInternshipExperience<
    Key extends keyof InternshipExperienceDraft,
  >(
    index: number,
    key: Key,
    value: InternshipExperienceDraft[Key],
  ) {
    setDraft((current) => ({
      ...current,
      internshipExperiences: current.internshipExperiences.map(
        (experience, experienceIndex) =>
          experienceIndex === index
            ? { ...experience, [key]: value }
            : experience,
      ),
    }));
  }

  function removeInternshipExperience(index: number) {
    setDraft((current) => ({
      ...current,
      internshipExperiences: current.internshipExperiences.filter(
        (_, experienceIndex) => experienceIndex !== index,
      ),
    }));
  }

  function updateDraftField<Key extends keyof typeof draft>(
    key: Key,
    value: (typeof draft)[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSubmitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    if (isAttachmentBusy) {
      setSubmitError("请等待附件操作完成后再提交");
      return;
    }

    const formElement = event.currentTarget;

    if (!formElement.checkValidity()) {
      formElement.reportValidity();
      return;
    }

    const incompleteField = findIncompleteRequiredField(draft);

    if (incompleteField) {
      setSubmitError(`请填写：${incompleteField}`);
      return;
    }

    if (draft.basicInfo.applicationDirection === "") {
      setSubmitError("请选择投递方向");
      return;
    }

    if (draft.hasIdCopyAndAgreement === null) {
      setSubmitError("请选择身份证件材料和服务协议是否齐全");
      return;
    }

    const attachmentTypes = new Set(
      attachments.map((attachment) => attachment.type),
    );
    const missingAttachments = [
      !attachmentTypes.has("resume") ? "个人简历" : null,
      !attachmentTypes.has("id_card_front")
        ? "身份证正面（或外籍护照首页）"
        : null,
      !attachmentTypes.has("id_card_back")
        ? "身份证反面（或外籍护照签证页）"
        : null,
    ].filter((label): label is string => label !== null);

    if (missingAttachments.length > 0) {
      setSubmitError(`请先上传必需附件：${missingAttachments.join("、")}`);
      return;
    }

    if (!form.onboardingStartAt || !form.workLocation) {
      setSubmitError("HR 尚未完成工作地点或入职开始日期安排");
      return;
    }

    setIsConfirmationOpen(true);
  }

  async function confirmSubmission() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const payload = buildStudentFormPayload(draft);
      await submitStudentForm(payload);
      router.replace("/student/submitted");
      router.refresh();
    } catch (error) {
      setIsConfirmationOpen(false);

      if (error instanceof ApiError && error.statusCode === 401) {
        router.replace("/student/login");
        return;
      }

      if (error instanceof ApiError && error.statusCode === 409) {
        router.replace("/student/submitted");
        return;
      }

      setSubmitError(
        error instanceof Error ? error.message : "登记表提交失败，请稍后重试",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8" onSubmit={handleSubmitRequest}>
      <section className="overflow-hidden rounded-lg border border-[#d2dee8] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.04)]">
        <div className="border-b border-[#d2dee8] px-5 py-6 sm:px-8">
          <p className="text-xs font-semibold text-[#184268]">01</p>
          <h2 className="mt-2 text-xl font-semibold">个人信息</h2>
        </div>

        <div className="grid gap-x-6 gap-y-5 px-5 py-6 sm:grid-cols-2 sm:px-8 sm:py-8 lg:grid-cols-3">
          <FormField htmlFor="student-name" label="姓名" required>
            <input
              id="student-name"
              className={inputClassName}
              value={form.name}
              disabled
            />
          </FormField>

          <FormField htmlFor="student-email" label="邮箱" required>
            <input
              id="student-email"
              className={inputClassName}
              value={form.email}
              disabled
            />
          </FormField>

          <FormField htmlFor="student-phone" label="联系电话" required>
            <input
              id="student-phone"
              className={inputClassName}
              type="tel"
              autoComplete="tel"
              maxLength={30}
              required
              value={draft.phone}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
            />
          </FormField>

          <FormField htmlFor="position" label="申请职位" required>
            <input
              id="position"
              className={inputClassName}
              maxLength={100}
              required
              value={draft.basicInfo.position}
              onChange={(event) =>
                updateBasicInfo("position", event.target.value)
              }
            />
          </FormField>

          <FormField
            htmlFor="application-direction"
            label="投递方向"
            required
          >
            <select
              id="application-direction"
              className={inputClassName}
              required
              value={draft.basicInfo.applicationDirection}
              onChange={(event) =>
                updateBasicInfo(
                  "applicationDirection",
                  event.target.value as StudentBasicInfoDraft["applicationDirection"],
                )
              }
            >
              <option value="">请选择</option>
              {APPLICATION_DIRECTIONS.map((direction) => (
                <option key={direction} value={direction}>
                  {direction}
                </option>
              ))}
            </select>
          </FormField>

          <FormField htmlFor="source-channel" label="投递渠道" required>
            <input
              id="source-channel"
              className={inputClassName}
              maxLength={100}
              required
              value={draft.basicInfo.sourceChannel}
              onChange={(event) =>
                updateBasicInfo("sourceChannel", event.target.value)
              }
            />
          </FormField>

          <FormField htmlFor="gender" label="性别" required>
            <select
              id="gender"
              className={inputClassName}
              required
              value={draft.basicInfo.gender}
              onChange={(event) => updateBasicInfo("gender", event.target.value)}
            >
              <option value="">请选择</option>
              <option value="女">女</option>
              <option value="男">男</option>
              <option value="其他">其他</option>
            </select>
          </FormField>

          <FormField htmlFor="birth-date" label="出生日期" required>
            <DatePickerInput
              id="birth-date"
              className={inputClassName}
              max={new Date().toISOString().slice(0, 10)}
              required
              value={draft.basicInfo.birthDate}
              onChange={(event) =>
                updateBasicInfo("birthDate", event.target.value)
              }
            />
          </FormField>

          <FormField
            htmlFor="id-number"
            label="身份证号码（或外籍护照号）"
            required
          >
            <input
              id="id-number"
              className={inputClassName}
              maxLength={50}
              required
              value={draft.basicInfo.idNumber}
              onChange={(event) =>
                updateBasicInfo("idNumber", event.target.value)
              }
            />
          </FormField>

          <FormField htmlFor="household-registration" label="户籍" required>
            <input
              id="household-registration"
              className={inputClassName}
              maxLength={200}
              required
              value={draft.basicInfo.householdRegistration}
              onChange={(event) =>
                updateBasicInfo("householdRegistration", event.target.value)
              }
            />
          </FormField>

          <FormField htmlFor="marital-status" label="婚姻状况">
            <select
              id="marital-status"
              className={inputClassName}
              value={draft.basicInfo.maritalStatus}
              onChange={(event) =>
                updateBasicInfo("maritalStatus", event.target.value)
              }
            >
              <option value="">请选择</option>
              <option value="未婚">未婚</option>
              <option value="已婚">已婚</option>
              <option value="其他">其他</option>
            </select>
          </FormField>

          <FormField htmlFor="political-status" label="政治面貌">
            <input
              id="political-status"
              className={inputClassName}
              maxLength={50}
              value={draft.basicInfo.politicalStatus}
              onChange={(event) =>
                updateBasicInfo("politicalStatus", event.target.value)
              }
            />
          </FormField>

          <FormField htmlFor="current-school" label="在读学校" required>
            <input
              id="current-school"
              className={inputClassName}
              maxLength={200}
              required
              value={draft.basicInfo.currentSchool}
              onChange={(event) =>
                updateBasicInfo("currentSchool", event.target.value)
              }
            />
          </FormField>

          <FormField htmlFor="major" label="专业" required>
            <input
              id="major"
              className={inputClassName}
              maxLength={100}
              required
              value={draft.basicInfo.major}
              onChange={(event) => updateBasicInfo("major", event.target.value)}
            />
          </FormField>

          <FormField htmlFor="degree" label="学历" required>
            <input
              id="degree"
              className={inputClassName}
              maxLength={50}
              required
              value={draft.basicInfo.degree}
              onChange={(event) => updateBasicInfo("degree", event.target.value)}
            />
          </FormField>

          <FormField htmlFor="home-phone" label="家庭电话">
            <input
              id="home-phone"
              className={inputClassName}
              type="tel"
              maxLength={30}
              value={draft.basicInfo.homePhone}
              onChange={(event) =>
                updateBasicInfo("homePhone", event.target.value)
              }
            />
          </FormField>

          <FormField
            htmlFor="home-address"
            label="家庭地址"
            required
            className="sm:col-span-2 lg:col-span-3"
          >
            <textarea
              id="home-address"
              className={`${inputClassName} min-h-24 resize-y`}
              maxLength={300}
              required
              value={draft.basicInfo.homeAddress}
              onChange={(event) =>
                updateBasicInfo("homeAddress", event.target.value)
              }
            />
          </FormField>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-[#d2dee8] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.04)]">
        <div className="flex flex-col gap-4 border-b border-[#d2dee8] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="text-xs font-semibold text-[#184268]">02</p>
            <h2 className="mt-2 text-xl font-semibold">
              教育经历 <span className="text-[#b44532]">*</span>
            </h2>
            <p className="mt-2 text-sm text-[#6b7f92]">
              请从本科经历开始填写。
            </p>
          </div>
          <button
            type="button"
            className={addButtonClassName}
            disabled={draft.educationExperiences.length >= 10}
            onClick={addEducationExperience}
          >
            + 添加经历
          </button>
        </div>

        {draft.educationExperiences.length === 0 ? (
          <div className="px-5 py-10 text-center sm:px-8">
            <p className="text-sm text-[#5f7285]">暂无教育经历</p>
            <button
              type="button"
              className={`${primaryButtonClassName} mt-4`}
              onClick={addEducationExperience}
            >
              添加第一条经历
            </button>
          </div>
        ) : (
          <div>
            {draft.educationExperiences.map((experience, index) => {
              const hasInvalidYearRange =
                experience.startYear !== "" &&
                experience.endYear !== "" &&
                Number(experience.endYear) < Number(experience.startYear);

              return (
                <fieldset
                  key={index}
                  className="border-b border-[#dee7ee] px-5 py-6 last:border-b-0 sm:px-8"
                >
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <legend className="text-sm font-semibold text-[#263746]">
                      教育经历 {index + 1}
                    </legend>
                    <button
                      type="button"
                      className={removeButtonClassName}
                      onClick={() => removeEducationExperience(index)}
                    >
                      删除
                    </button>
                  </div>

                  <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                    <FormField
                      htmlFor={`education-${index}-start-year`}
                      label="起始年份"
                      required
                    >
                      <input
                        id={`education-${index}-start-year`}
                        className={inputClassName}
                        type="number"
                        inputMode="numeric"
                        min={1900}
                        max={2100}
                        required
                        value={experience.startYear}
                        onChange={(event) =>
                          updateEducationExperience(
                            index,
                            "startYear",
                            event.target.value,
                          )
                        }
                      />
                    </FormField>

                    <FormField
                      htmlFor={`education-${index}-end-year`}
                      label="结束年份"
                      required
                    >
                      <input
                        id={`education-${index}-end-year`}
                        className={inputClassName}
                        type="number"
                        inputMode="numeric"
                        min={experience.startYear || 1900}
                        max={2100}
                        required
                        aria-invalid={hasInvalidYearRange}
                        aria-describedby={
                          hasInvalidYearRange
                            ? `education-${index}-year-error`
                            : undefined
                        }
                        value={experience.endYear}
                        onChange={(event) =>
                          updateEducationExperience(
                            index,
                            "endYear",
                            event.target.value,
                          )
                        }
                      />
                      {hasInvalidYearRange ? (
                        <p
                          id={`education-${index}-year-error`}
                          className="mt-2 text-xs text-[#b44532]"
                        >
                          结束年份不能早于起始年份
                        </p>
                      ) : null}
                    </FormField>

                    <FormField
                      htmlFor={`education-${index}-school`}
                      label="学校"
                      required
                    >
                      <input
                        id={`education-${index}-school`}
                        className={inputClassName}
                        maxLength={200}
                        required
                        value={experience.school}
                        onChange={(event) =>
                          updateEducationExperience(
                            index,
                            "school",
                            event.target.value,
                          )
                        }
                      />
                    </FormField>

                    <FormField
                      htmlFor={`education-${index}-major`}
                      label="专业"
                      required
                    >
                      <input
                        id={`education-${index}-major`}
                        className={inputClassName}
                        maxLength={100}
                        required
                        value={experience.major}
                        onChange={(event) =>
                          updateEducationExperience(
                            index,
                            "major",
                            event.target.value,
                          )
                        }
                      />
                    </FormField>

                    <FormField
                      htmlFor={`education-${index}-advisor`}
                      label="班主任 / 导师"
                    >
                      <input
                        id={`education-${index}-advisor`}
                        className={inputClassName}
                        maxLength={100}
                        value={experience.advisor}
                        onChange={(event) =>
                          updateEducationExperience(
                            index,
                            "advisor",
                            event.target.value,
                          )
                        }
                      />
                    </FormField>

                    <FormField
                      htmlFor={`education-${index}-phone`}
                      label="联系电话"
                    >
                      <input
                        id={`education-${index}-phone`}
                        className={inputClassName}
                        type="tel"
                        maxLength={30}
                        value={experience.phone}
                        onChange={(event) =>
                          updateEducationExperience(
                            index,
                            "phone",
                            event.target.value,
                          )
                        }
                      />
                    </FormField>
                  </div>
                </fieldset>
              );
            })}
          </div>
        )}
      </section>

      <FamilyMembersSection
        members={draft.familyMembers}
        onAdd={addFamilyMember}
        onUpdate={updateFamilyMember}
        onRemove={removeFamilyMember}
      />

      <InternshipExperiencesSection
        experiences={draft.internshipExperiences}
        onAdd={addInternshipExperience}
        onUpdate={updateInternshipExperience}
        onRemove={removeInternshipExperience}
      />

      <SupplementaryInfoSection
        studentName={form.name}
        onboardingStartAt={form.onboardingStartAt}
        draft={draft}
        onUpdate={updateDraftField}
      />

      <AttachmentsSection
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        onBusyChange={setIsAttachmentBusy}
      />

      <StudentFormSubmitSection
        form={form}
        draft={draft}
        attachments={attachments}
        isAttachmentBusy={isAttachmentBusy}
        isSubmitting={isSubmitting}
        isConfirmationOpen={isConfirmationOpen}
        errorMessage={submitError}
        onCloseConfirmation={() => setIsConfirmationOpen(false)}
        onConfirmSubmission={confirmSubmission}
      />
    </form>
  );
}
