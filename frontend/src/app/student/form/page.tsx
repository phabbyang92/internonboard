"use client";

import { StudentPageHeader } from "@/components/student/student-page-header";
import { StudentPageState } from "@/components/student/student-page-state";
import { StudentRegistrationForm } from "@/components/student/student-registration-form";
import { useStudentFormAccess } from "@/hooks/use-student-form-access";
import { formatDateOnly } from "@/lib/format-date";

export default function StudentFormPage() {
  const { form, isLoading, errorMessage } =
    useStudentFormAccess("editable");

  if (isLoading) {
    return <StudentPageState message="正在读取登记信息..." />;
  }

  if (errorMessage) {
    return <StudentPageState message={errorMessage} isError />;
  }

  if (!form) {
    return <StudentPageState message="正在跳转..." />;
  }

  return (
    <div className="min-h-screen bg-[#f3f7fa] text-[#172735]">
      <StudentPageHeader
        studentName={form.name}
        studentEmail={form.email}
      />

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col justify-between gap-4 border-b border-[#ccd7d3] pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-[#184268]">入职登记</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
              实习生工作登记表
            </h1>
          </div>
          <span className="w-fit rounded-full border border-[#e8b78f] bg-[#fff7ef] px-3 py-1.5 text-sm font-medium text-[#9a5527]">
            尚未提交
          </span>
        </div>

        <section className="mt-8 overflow-hidden rounded-lg border border-[#d2dee8] bg-white shadow-[0_4px_18px_rgba(24,66,104,0.05)]">
          <dl className="grid sm:grid-cols-2 lg:grid-cols-4">
            <div className="border-b border-[#dee7ee] p-5 sm:border-r lg:border-b-0">
              <dt className="text-xs font-medium text-[#6b7f92]">姓名</dt>
              <dd className="mt-2 text-sm font-semibold">{form.name}</dd>
            </div>
            <div className="border-b border-[#dee7ee] p-5 lg:border-b-0 lg:border-r">
              <dt className="text-xs font-medium text-[#6b7f92]">工作地点</dt>
              <dd className="mt-2 text-sm font-semibold">
                {form.workLocation ?? "未设置"}
              </dd>
            </div>
            <div className="border-b border-[#dee7ee] p-5 sm:border-r sm:border-b-0">
              <dt className="text-xs font-medium text-[#6b7f92]">入职开始日期</dt>
              <dd className="mt-2 text-sm font-semibold">
                {formatDateOnly(form.onboardingStartAt)}
              </dd>
            </div>
            <div className="p-5">
              <dt className="text-xs font-medium text-[#6b7f92]">登记状态</dt>
              <dd className="mt-2 text-sm font-semibold text-[#9a5527]">
                待填写
              </dd>
            </div>
          </dl>
        </section>

        <div className="mt-8 rounded-md border-l-4 border-[#c46b3c] bg-[#fff7ef] px-4 py-3 text-sm leading-6 text-[#774020]">
          登记表只能提交一次，请确认个人资料和附件准确无误后再提交。
        </div>

        <StudentRegistrationForm form={form} />
      </main>
    </div>
  );
}
