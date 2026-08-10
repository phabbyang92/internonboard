"use client";

import { StudentPageHeader } from "@/components/student/student-page-header";
import { StudentPageState } from "@/components/student/student-page-state";
import { StudentSubmittedForm } from "@/components/student/student-submitted-form";
import { WorkLocationLabel } from "@/components/ui/work-location-label";
import { useStudentFormAccess } from "@/hooks/use-student-form-access";
import { formatDateOnly } from "@/lib/format-date";
import { CalendarClock, MapPin } from "lucide-react";

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
        <div className="rounded-lg border-l-4 border-[#4d82aa] bg-white px-6 py-7 shadow-[0_4px_18px_rgba(24,66,104,0.05)] sm:px-8">
          <p className="text-sm font-semibold text-[#184268]">等待入职</p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
            登记已完成，请等待入职
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#5f7285]">
            入职开始日期前无需登记考勤。登记信息当前为只读状态，如需更正请联系 HR。
          </p>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-[#f3f7fa] px-4 py-3">
              <dt className="flex items-center gap-2 text-xs font-medium text-[#6b7f92]">
                <CalendarClock size={14} aria-hidden="true" />
                入职开始日期
              </dt>
              <dd className="mt-2 text-sm font-semibold text-[#203446]">
                {formatDateOnly(form.onboardingStartAt)}
              </dd>
            </div>
            <div className="rounded-md bg-[#f3f7fa] px-4 py-3">
              <dt className="flex items-center gap-2 text-xs font-medium text-[#6b7f92]">
                <MapPin size={14} aria-hidden="true" />
                首段工作地点
              </dt>
              <dd className="mt-2 text-sm text-[#203446]">
                {form.workLocation ? (
                  <WorkLocationLabel location={form.workLocation} />
                ) : (
                  "等待 HR 安排"
                )}
              </dd>
            </div>
          </dl>
        </div>

        <StudentSubmittedForm form={form} />
      </main>
    </div>
  );
}
