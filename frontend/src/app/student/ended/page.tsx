"use client";

import { StudentPageHeader } from "@/components/student/student-page-header";
import { StudentPageState } from "@/components/student/student-page-state";
import { useStudentPortalAccess } from "@/hooks/use-student-portal-access";

export default function StudentEndedPage() {
  const { portal, isLoading, errorMessage } = useStudentPortalAccess("ended");

  if (isLoading) {
    return <StudentPageState message="正在读取工作台状态..." />;
  }

  if (errorMessage) {
    return <StudentPageState message={errorMessage} isError />;
  }

  if (!portal) {
    return <StudentPageState message="正在跳转..." />;
  }

  return (
    <div className="min-h-screen bg-[#f3f7fa] text-[#172735]">
      <StudentPageHeader studentName={portal.student.name} />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="rounded-lg border-l-4 border-[#6b7f92] bg-white px-6 py-8 shadow-[0_4px_18px_rgba(24,66,104,0.05)] sm:px-8">
          <p className="text-sm font-semibold text-[#52677a]">实习已结束</p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
            本次考勤周期已结束
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#5f7285]">
            实习结束日期次日起，出勤和请假登记入口会自动关闭。如对历史考勤记录有疑问，请联系 HR。
          </p>
        </section>
      </main>
    </div>
  );
}
