"use client";

import { formatDateOnly, formatDateTime } from "@/lib/format-date";
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
  return (
    <>
      <section className="mt-6 border border-[#d5dedb] bg-white">
        <div className="border-b border-[#d5dedb] px-5 py-6 sm:px-8">
          <p className="text-xs font-semibold text-[#147565]">08</p>
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
              className="min-h-12 bg-[#147565] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0f6255] focus:outline-none focus:ring-2 focus:ring-[#147565]/25 disabled:cursor-not-allowed disabled:bg-[#8a9d97]"
              disabled={isAttachmentBusy || isSubmitting}
            >
              {isAttachmentBusy ? "附件处理中..." : "核对并提交"}
            </button>
          </div>
        </div>
      </section>

      {isConfirmationOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8"
          role="presentation"
        >
          <div
            className="max-h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submission-confirmation-title"
          >
            <div className="border-b border-[#d5dedb] px-5 py-5 sm:px-7">
              <h2
                id="submission-confirmation-title"
                className="text-xl font-semibold"
              >
                确认提交登记表
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#66736f]">
                请最后核对以下关键信息。确认后登记表将变为只读。
              </p>
            </div>

            <dl className="grid sm:grid-cols-2">
              {[
                ["姓名", form.name],
                ["邮箱", form.email],
                ["联系电话", draft.phone],
                ["申请职位", draft.basicInfo.position],
                ["投递方向", draft.basicInfo.applicationDirection],
                ["工作地点", form.workLocation ?? "未设置"],
                ["入职开始时间", formatDateTime(form.onboardingStartAt)],
                ["实习结束日期", formatDateOnly(draft.onboardingEndAt)],
                ["附件数量", `${attachments.length} 个`],
                ["申请人签名", draft.applicantSignature],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="border-b border-[#e5ebe9] px-5 py-4 odd:sm:border-r sm:px-7"
                >
                  <dt className="text-xs font-medium text-[#75817d]">
                    {label}
                  </dt>
                  <dd className="mt-1.5 break-words text-sm font-medium">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-col-reverse gap-3 px-5 py-5 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                className="min-h-11 border border-[#bdc9c5] px-5 py-2 text-sm font-semibold text-[#44514d] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                onClick={onCloseConfirmation}
              >
                返回修改
              </button>
              <button
                type="button"
                className="min-h-11 bg-[#147565] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#0f6255] disabled:cursor-not-allowed disabled:bg-[#8a9d97]"
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
