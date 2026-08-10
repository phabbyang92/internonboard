"use client";

import { StudentAttendanceDashboard } from "@/components/student/student-attendance-dashboard";
import { StudentAttendanceRecords } from "@/components/student/student-attendance-records";
import { StudentLeaveRegistration } from "@/components/student/student-leave-registration";
import { StudentPageHeader } from "@/components/student/student-page-header";
import { StudentPageState } from "@/components/student/student-page-state";
import { useStudentPortalAccess } from "@/hooks/use-student-portal-access";
import { useState } from "react";

type AttendanceView = "today" | "leave" | "records";

export default function StudentAttendancePage() {
  const [activeView, setActiveView] = useState<AttendanceView>("today");
  const { portal, isLoading, errorMessage } =
    useStudentPortalAccess("attendance");

  if (isLoading) {
    return <StudentPageState message="正在读取今日考勤..." />;
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
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col justify-between gap-4 border-b border-[#ccd9e4] pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-[#184268]">学生考勤</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
              考勤工作台
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#5f7285]">
              查看今日安排、登记请假和个人出勤记录。
            </p>
          </div>
          <nav
            aria-label="考勤视图"
            className="flex w-fit gap-1 rounded-md bg-[#e7eff6] p-1"
          >
            {([
              ["today", "今日考勤"],
              ["leave", "请假登记"],
              ["records", "出勤记录"],
            ] as const).map(([view, label]) => (
              <button
                key={view}
                type="button"
                aria-current={activeView === view ? "page" : undefined}
                onClick={() => setActiveView(view)}
                className={`rounded px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#184268]/20 ${
                  activeView === view
                    ? "bg-white text-[#184268] shadow-sm"
                    : "text-[#52677a] hover:text-[#184268]"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-7">
          {activeView === "today" ? <StudentAttendanceDashboard /> : null}
          {activeView === "leave" ? <StudentLeaveRegistration /> : null}
          {activeView === "records" ? <StudentAttendanceRecords /> : null}
        </div>
      </main>
    </div>
  );
}
