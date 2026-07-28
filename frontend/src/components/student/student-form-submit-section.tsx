"use client";

import { useEffect, type ReactNode } from "react";

import { WorkLocationLabel } from "@/components/ui/work-location-label";
import { formatDateOnly } from "@/lib/format-date";
import type { AttachmentMetadata, StudentForm } from "@/types/student";
import type { StudentFormDraft } from "@/types/student-form-draft";

interface StudentFormSubmitSectionProps {
  form: StudentForm;
  draft: StudentFormDraft;
  attachments: AttachmentMetadata[];
  isAttachmentBusy: boolean;
  isSubmitting: boolean;
  isConfirmationOpen: boolean;
  errorMessage: string;
  onCloseConfirmation: () => void;
  onConfirmSubmission: () => void;
}

const attachmentLabels: Record<AttachmentMetadata["type"], string> = {
  resume: "个人简历",
  id_card_front: "身份证正面（或外籍护照首页）",
  id_card_back: "身份证反面（或外籍护照签证页）",
};

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "未填写";
  }

  return String(value);
}

function displayDraftDate(value: string | null | undefined): string {
  if (!value) {
    return "未填写";
  }

  const datePart = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart)
    ? datePart.replaceAll("-", "/")
    : displayValue(value);
}

function ReviewItem({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`min-w-0 border-b border-[#e4eaf0] py-2.5 ${
        wide ? "sm:col-span-2 lg:col-span-3" : ""
      }`}
    >
      <dt className="text-xs font-medium text-[#6b7f92]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium leading-5 text-[#1d2d3b]">
        {value}
      </dd>
    </div>
  );
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-[#cfdbe5] px-5 py-4 last:border-b-0 sm:px-7">
      <h3 className="text-sm font-semibold text-[#184268]">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ReviewRecord({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-[#e4eaf0] py-2.5 first:border-t-0 first:pt-0 last:pb-0">
      <p className="text-xs font-semibold text-[#425a6e]">{title}</p>
      <dl className="mt-1 grid gap-x-5 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </dl>
    </div>
  );
}

export function StudentFormSubmitSection({
  form,
  draft,
  attachments,
  isAttachmentBusy,
  isSubmitting,
  isConfirmationOpen,
  errorMessage,
  onCloseConfirmation,
  onConfirmSubmission,
}: StudentFormSubmitSectionProps) {
  useEffect(() => {
    if (!isConfirmationOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isConfirmationOpen]);

  return (
    <>
      <section className="mt-6 overflow-hidden rounded-lg border border-[#d2dee8] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.04)]">
        <div className="border-b border-[#d2dee8] px-5 py-6 sm:px-8">
          <p className="text-xs font-semibold text-[#184268]">08</p>
          <h2 className="mt-2 text-xl font-semibold">提交登记表</h2>
        </div>

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <div className="border-l-4 border-[#c46b3c] bg-[#fff7ef] px-4 py-3 text-sm leading-6 text-[#774020]">
            登记表只能提交一次。提交后学生端无法自行修改，请确认登记信息和附件准确无误。
          </div>

          {errorMessage ? (
            <div
              className="mt-5 border-l-4 border-[#b44532] bg-[#fff3f0] px-4 py-3 text-sm text-[#873426]"
              role="alert"
            >
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              className="min-h-12 cursor-pointer rounded-md bg-[#184268] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#123653] focus:outline-none focus:ring-2 focus:ring-[#184268]/25 disabled:cursor-not-allowed disabled:bg-[#8da3b6]"
              disabled={isAttachmentBusy || isSubmitting}
            >
              {isAttachmentBusy ? "附件处理中..." : "核对并提交"}
            </button>
          </div>
        </div>
      </section>

      {isConfirmationOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-3 py-4 sm:px-5"
          role="presentation"
        >
          <div
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submission-confirmation-title"
          >
            <div className="shrink-0 border-b border-[#d2dee8] px-5 py-4 sm:px-7">
              <h2
                id="submission-confirmation-title"
                className="text-xl font-semibold"
              >
                确认提交登记表
              </h2>
              <div
                className="mt-3 rounded-md border border-[#e7c594] bg-[#fff8eb] px-3 py-2 text-sm font-semibold text-[#7b4a17]"
                role="alert"
              >
                请同学确认填写信息无误，提交后无法更改。
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <ReviewSection title="个人情况">
                <dl className="grid gap-x-5 sm:grid-cols-2 lg:grid-cols-3">
                  <ReviewItem label="姓名" value={form.name} />
                  <ReviewItem label="邮箱" value={form.email} />
                  <ReviewItem label="联系电话" value={draft.phone} />
                  <ReviewItem
                    label="申请职位"
                    value={draft.basicInfo.position}
                  />
                  <ReviewItem
                    label="投递方向"
                    value={draft.basicInfo.applicationDirection}
                  />
                  <ReviewItem
                    label="投递渠道"
                    value={draft.basicInfo.sourceChannel}
                  />
                  <ReviewItem
                    label="性别"
                    value={draft.basicInfo.gender}
                  />
                  <ReviewItem
                    label="出生日期"
                    value={displayDraftDate(draft.basicInfo.birthDate)}
                  />
                  <ReviewItem
                    label="身份证号码（或外籍护照号）"
                    value={draft.basicInfo.idNumber}
                  />
                  <ReviewItem
                    label="户籍"
                    value={draft.basicInfo.householdRegistration}
                  />
                  <ReviewItem
                    label="婚姻状况"
                    value={displayValue(draft.basicInfo.maritalStatus)}
                  />
                  <ReviewItem
                    label="学历"
                    value={draft.basicInfo.degree}
                  />
                  <ReviewItem
                    label="在读学校"
                    value={draft.basicInfo.currentSchool}
                  />
                  <ReviewItem
                    label="专业"
                    value={draft.basicInfo.major}
                  />
                  <ReviewItem
                    label="政治面貌"
                    value={displayValue(draft.basicInfo.politicalStatus)}
                  />
                  <ReviewItem
                    label="家庭地址"
                    value={draft.basicInfo.homeAddress}
                    wide
                  />
                  <ReviewItem
                    label="家庭电话"
                    value={displayValue(draft.basicInfo.homePhone)}
                  />
                </dl>
              </ReviewSection>

              <ReviewSection title="实习安排">
                <dl className="grid gap-x-5 sm:grid-cols-2 lg:grid-cols-3">
                  <ReviewItem
                    label="工作地点"
                    value={
                      form.workLocation ? (
                        <WorkLocationLabel location={form.workLocation} />
                      ) : (
                        "未设置"
                      )
                    }
                  />
                  <ReviewItem
                    label="实习开始日期"
                    value={formatDateOnly(form.onboardingStartAt)}
                  />
                  <ReviewItem
                    label="实习结束日期"
                    value={displayDraftDate(draft.onboardingEndAt)}
                  />
                </dl>
              </ReviewSection>

              <ReviewSection title="教育经历">
                {draft.educationExperiences.map((experience, index) => (
                  <ReviewRecord
                    key={`education-${index}`}
                    title={`教育经历 ${index + 1}`}
                  >
                    <ReviewItem
                      label="起始年份"
                      value={experience.startYear}
                    />
                    <ReviewItem
                      label="结束年份"
                      value={experience.endYear}
                    />
                    <ReviewItem label="学校" value={experience.school} />
                    <ReviewItem label="专业" value={experience.major} />
                    <ReviewItem
                      label="班主任 / 导师"
                      value={displayValue(experience.advisor)}
                    />
                    <ReviewItem
                      label="联系电话"
                      value={displayValue(experience.phone)}
                    />
                  </ReviewRecord>
                ))}
              </ReviewSection>

              <ReviewSection title="家庭成员">
                {draft.familyMembers.map((member, index) => (
                  <ReviewRecord
                    key={`family-${index}`}
                    title={`家庭成员 ${index + 1}`}
                  >
                    <ReviewItem label="关系" value={member.relation} />
                    <ReviewItem label="姓名" value={member.name} />
                    <ReviewItem
                      label="工作单位"
                      value={displayValue(member.employer)}
                    />
                    <ReviewItem
                      label="联系电话"
                      value={displayValue(member.phone)}
                    />
                  </ReviewRecord>
                ))}
              </ReviewSection>

              <ReviewSection title="校外实习或兼职经历">
                {draft.internshipExperiences.length > 0 ? (
                  draft.internshipExperiences.map((experience, index) => (
                    <ReviewRecord
                      key={`internship-${index}`}
                      title={`实习经历 ${index + 1}`}
                    >
                      <ReviewItem
                        label="起始年份"
                        value={experience.startYear}
                      />
                      <ReviewItem
                        label="结束年份"
                        value={experience.endYear}
                      />
                      <ReviewItem
                        label="实习公司"
                        value={experience.company}
                      />
                      <ReviewItem
                        label="证明人"
                        value={displayValue(experience.referenceName)}
                      />
                      <ReviewItem
                        label="联系电话"
                        value={displayValue(experience.phone)}
                      />
                    </ReviewRecord>
                  ))
                ) : (
                  <p className="py-1 text-sm text-[#6b7f92]">
                    无校外实习或兼职经历
                  </p>
                )}
              </ReviewSection>

              <ReviewSection title="补充信息和签署">
                <dl className="grid gap-x-5 sm:grid-cols-2 lg:grid-cols-3">
                  <ReviewItem
                    label="紧急联系人姓名"
                    value={draft.emergencyContactName}
                  />
                  <ReviewItem
                    label="紧急联系人电话"
                    value={draft.emergencyContactPhone}
                  />
                  <ReviewItem
                    label="紧急联系人关系"
                    value={draft.emergencyContactRelation}
                  />
                  <ReviewItem
                    label="身份证复印件和学生证是否齐全"
                    value={
                      draft.hasIdCopyAndAgreement === null
                        ? "未填写"
                        : draft.hasIdCopyAndAgreement
                          ? "是"
                          : "否"
                    }
                  />
                  <ReviewItem
                    label="其他需要补充说明的情况"
                    value={displayValue(draft.notes)}
                    wide
                  />
                  <ReviewItem
                    label="申请人签名"
                    value={draft.applicantSignature}
                  />
                  <ReviewItem
                    label="签署日期"
                    value={displayDraftDate(draft.applicantSignedAt)}
                  />
                </dl>
              </ReviewSection>

              <ReviewSection title={`附件资料（${attachments.length} 个）`}>
                <dl className="grid gap-x-5 sm:grid-cols-2 lg:grid-cols-3">
                  {attachments.map((attachment) => (
                    <ReviewItem
                      key={`${attachment.type}-${attachment.storageKey}`}
                      label={attachmentLabels[attachment.type]}
                      value={attachment.originalName}
                    />
                  ))}
                </dl>
              </ReviewSection>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[#d2dee8] bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                className="min-h-11 cursor-pointer rounded-md border border-[#b9c8d5] px-5 py-2 text-sm font-semibold text-[#425a6e] transition hover:bg-[#f4f7fa] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                onClick={onCloseConfirmation}
              >
                返回修改
              </button>
              <button
                type="button"
                className="min-h-11 cursor-pointer rounded-md bg-[#184268] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#123653] disabled:cursor-not-allowed disabled:bg-[#8da3b6]"
                disabled={isSubmitting}
                onClick={onConfirmSubmission}
              >
                {isSubmitting ? "正在提交..." : "确认提交"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
