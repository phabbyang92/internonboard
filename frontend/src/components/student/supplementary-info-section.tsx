"use client";

import { FormField } from "@/components/student/form-field";
import { inputClassName } from "@/components/student/form-control-styles";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { toChinaDateInput } from "@/lib/format-date";
import type { StudentFormDraft } from "@/types/student-form-draft";

type SupplementaryField =
  | "onboardingEndAt"
  | "emergencyContactName"
  | "emergencyContactPhone"
  | "emergencyContactRelation"
  | "hasIdCopyAndAgreement"
  | "notes"
  | "applicantSignature"
  | "applicantSignedAt";

interface SupplementaryInfoSectionProps {
  studentName: string;
  onboardingStartAt: string | null;
  draft: StudentFormDraft;
  onUpdate: <Key extends SupplementaryField>(
    key: Key,
    value: StudentFormDraft[Key],
  ) => void;
}

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMinimumEndDate(onboardingStartAt: string | null) {
  if (!onboardingStartAt) {
    return "";
  }

  const startDate = toChinaDateInput(onboardingStartAt);
  const [year, month, day] = startDate.split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));

  return nextDay.toISOString().slice(0, 10);
}

export function SupplementaryInfoSection({
  studentName,
  onboardingStartAt,
  draft,
  onUpdate,
}: SupplementaryInfoSectionProps) {
  const today = getTodayInputValue();
  const minimumEndDate = getMinimumEndDate(onboardingStartAt);
  const hasInvalidEndDate =
    draft.onboardingEndAt !== "" &&
    minimumEndDate !== "" &&
    draft.onboardingEndAt < minimumEndDate;

  return (
    <>
      <section className="mt-6 overflow-hidden rounded-lg border border-[#d2dee8] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.04)]">
        <div className="border-b border-[#d2dee8] px-5 py-6 sm:px-8">
          <p className="text-xs font-semibold text-[#184268]">05</p>
          <h2 className="mt-2 text-xl font-semibold">补充信息</h2>
        </div>

        <div className="grid gap-x-6 gap-y-5 px-5 py-6 sm:grid-cols-2 sm:px-8 sm:py-8 lg:grid-cols-3">
          <FormField
            htmlFor="onboarding-end-at"
            label="实习结束日期"
            required
            className="sm:col-span-2 lg:col-span-3"
          >
            <DatePickerInput
              id="onboarding-end-at"
              className={inputClassName}
              min={minimumEndDate || undefined}
              required
              aria-invalid={hasInvalidEndDate}
              aria-describedby={
                hasInvalidEndDate ? "onboarding-end-at-error" : undefined
              }
              value={draft.onboardingEndAt}
              onChange={(event) =>
                onUpdate("onboardingEndAt", event.target.value)
              }
            />
            {hasInvalidEndDate ? (
              <p
                id="onboarding-end-at-error"
                className="mt-2 text-xs text-[#b44532]"
              >
                实习结束日期必须晚于入职开始日期
              </p>
            ) : null}
          </FormField>

          <FormField
            htmlFor="emergency-contact-name"
            label="紧急联系人姓名"
            required
          >
            <input
              id="emergency-contact-name"
              className={inputClassName}
              maxLength={100}
              required
              value={draft.emergencyContactName}
              onChange={(event) =>
                onUpdate("emergencyContactName", event.target.value)
              }
            />
          </FormField>

          <FormField
            htmlFor="emergency-contact-phone"
            label="紧急联系人电话"
            required
          >
            <input
              id="emergency-contact-phone"
              className={inputClassName}
              type="tel"
              maxLength={30}
              required
              value={draft.emergencyContactPhone}
              onChange={(event) =>
                onUpdate("emergencyContactPhone", event.target.value)
              }
            />
          </FormField>

          <FormField
            htmlFor="emergency-contact-relation"
            label="紧急联系人关系"
            required
          >
            <input
              id="emergency-contact-relation"
              className={inputClassName}
              maxLength={50}
              required
              value={draft.emergencyContactRelation}
              onChange={(event) =>
                onUpdate("emergencyContactRelation", event.target.value)
              }
            />
          </FormField>

          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-semibold text-[#263746]">
              身份证复印件和学生证是否齐全
              <span className="ml-1 text-[#b44532]" aria-hidden="true">
                *
              </span>
            </legend>
            <div className="flex min-h-11 flex-wrap items-center gap-x-7 gap-y-3 border border-[#b7c7d4] px-4 py-2.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="has-id-copy-and-agreement"
                  required
                  checked={draft.hasIdCopyAndAgreement === true}
                  onChange={() => onUpdate("hasIdCopyAndAgreement", true)}
                />
                是
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="has-id-copy-and-agreement"
                  required
                  checked={draft.hasIdCopyAndAgreement === false}
                  onChange={() => onUpdate("hasIdCopyAndAgreement", false)}
                />
                否
              </label>
            </div>
          </fieldset>

          <FormField
            htmlFor="notes"
            label="其他需要补充说明的情况"
            className="sm:col-span-2 lg:col-span-3"
          >
            <textarea
              id="notes"
              className={`${inputClassName} min-h-28 resize-y`}
              maxLength={2000}
              value={draft.notes}
              onChange={(event) => onUpdate("notes", event.target.value)}
            />
          </FormField>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-[#d2dee8] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.04)]">
        <div className="border-b border-[#d2dee8] px-5 py-6 sm:px-8">
          <p className="text-xs font-semibold text-[#184268]">06</p>
          <h2 className="mt-2 text-xl font-semibold">申请人签署</h2>
        </div>

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <p className="border-l-4 border-[#184268] bg-[#eff5fa] px-4 py-3 text-sm leading-6 text-[#344b5e]">
            本人所填上列各项属事实，若有不实或虚构，公司有权开除或作出相应的处分
          </p>

          <div className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <FormField
              htmlFor="applicant-signature"
              label="申请人签名"
              required
            >
              <input
                id="applicant-signature"
                className={inputClassName}
                maxLength={100}
                required
                autoComplete="name"
                placeholder={studentName}
                value={draft.applicantSignature}
                onChange={(event) =>
                  onUpdate("applicantSignature", event.target.value)
                }
              />
            </FormField>

            <FormField
              htmlFor="applicant-signed-at"
              label="签署日期"
              required
            >
              <DatePickerInput
                id="applicant-signed-at"
                className={inputClassName}
                max={today}
                required
                value={draft.applicantSignedAt}
                onChange={(event) =>
                  onUpdate("applicantSignedAt", event.target.value)
                }
              />
            </FormField>
          </div>
        </div>
      </section>
    </>
  );
}
