"use client";

import { StudentPageHeader } from "@/components/student/student-page-header";
import { StudentPageState } from "@/components/student/student-page-state";
import { useStudentFormAccess } from "@/hooks/use-student-form-access";
import { formatDateOnly, formatDateTime } from "@/lib/format-date";

export default function StudentSubmittedPage() {
  const { form, isLoading, errorMessage } =
    useStudentFormAccess("submitted");

  if (isLoading) {
    return <StudentPageState message="正在读取提交记录..." />;
  }

  if (errorMessage) {
    return <StudentPageState message={errorMessage} isError />;
  }

  if (!form) {
    return <StudentPageState message="正在跳转..." />;
  }

  return (
    <div className="min-h-screen bg-[#f3f6f5] text-[#17221f]">
      <StudentPageHeader
        studentName={form.name}
        studentEmail={form.email}
      />

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="border-l-4 border-[#147565] bg-white px-6 py-7 sm:px-8">
          <p className="text-sm font-semibold text-[#147565]">提交成功</p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
            登记表已提交
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#66736f]">
            当前登记信息为只读状态。如需更正，请联系 HR。
          </p>
        </div>

        <section className="mt-8 bg-white">
          <div className="border-b border-[#dce4e1] px-6 py-5 sm:px-8">
            <h2 className="text-lg font-semibold">登记摘要</h2>
          </div>
          <dl className="grid sm:grid-cols-2">
            {[
              ["姓名", form.name],
              ["邮箱", form.email],
              ["工作地点", form.workLocation ?? "未设置"],
              ["入职开始时间", formatDateTime(form.onboardingStartAt)],
              ["实习结束日期", formatDateOnly(form.onboardingEndAt)],
              ["提交时间", formatDateTime(form.submittedAt)],
              ["联系电话", form.phone ?? "未填写"],
              ["附件数量", `${form.attachments.length} 个`],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border-b border-[#e5ebe9] px-6 py-5 sm:px-8 odd:sm:border-r"
              >
                <dt className="text-xs font-medium text-[#75817d]">{label}</dt>
                <dd className="mt-2 break-words text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
