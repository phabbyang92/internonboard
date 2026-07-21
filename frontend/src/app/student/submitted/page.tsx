"use client";

import { StudentPageHeader } from "@/components/student/student-page-header";
import { StudentPageState } from "@/components/student/student-page-state";
import { StudentSubmittedForm } from "@/components/student/student-submitted-form";
import { useStudentFormAccess } from "@/hooks/use-student-form-access";

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
    <div className="min-h-screen bg-[#f3f7fa] text-[#172735]">
      <StudentPageHeader
        studentName={form.name}
        studentEmail={form.email}
      />

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="rounded-lg border-l-4 border-[#2f8a70] bg-white px-6 py-7 shadow-[0_4px_18px_rgba(24,66,104,0.05)] sm:px-8">
          <p className="text-sm font-semibold text-[#176555]">提交成功</p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
            登记表已提交
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#5f7285]">
            当前登记信息为只读状态。如需更正，请联系 HR。
          </p>
        </div>

        <StudentSubmittedForm form={form} />
      </main>
    </div>
  );
}
