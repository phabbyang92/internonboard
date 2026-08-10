"use client";

import {
  HrAttendanceWorkspace,
  type HrAttendanceView,
} from "@/components/hr/hr-attendance-workspace";
import { HrDailyAttendance } from "@/components/hr/hr-daily-attendance";
import { HrAttendanceSummary } from "@/components/hr/hr-attendance-summary";
import { HrRegionPermissions } from "@/components/hr/hr-region-permissions";
import { HrWorkCalendar } from "@/components/hr/hr-work-calendar";
import { HrOfficeNetworks } from "@/components/hr/hr-office-networks";
import { HrPageState } from "@/components/hr/hr-page-state";
import { HrShell } from "@/components/hr/hr-shell";
import { useHrSession } from "@/hooks/use-hr-session";

interface HrAttendancePageProps {
  view: HrAttendanceView;
}

export function HrAttendancePage({ view }: HrAttendancePageProps) {
  const { user, isLoading, errorMessage } = useHrSession();

  if (isLoading) {
    return <HrPageState message="正在确认 HR 登录状态..." />;
  }

  if (errorMessage) {
    return <HrPageState message={errorMessage} isError />;
  }

  if (!user) {
    return <HrPageState message="正在跳转到登录页..." />;
  }

  return (
    <HrShell user={user}>
      <HrAttendanceWorkspace view={view} user={user}>
        {view === "daily" ? <HrDailyAttendance user={user} /> : null}
        {view === "summary" ? <HrAttendanceSummary user={user} /> : null}
        {view === "calendar" ? <HrWorkCalendar /> : null}
        {view === "regions" && user.role === "admin" ? (
          <HrRegionPermissions />
        ) : null}
        {view === "regions" && user.role !== "admin" ? (
          <section className="rounded-lg border border-[#e4a99f] bg-[#fff3f1] px-5 py-8 text-center text-sm text-[#9d3426]">
            只有 Admin HR 可以管理地区权限。
          </section>
        ) : null}
        {view === "networks" && user.role === "admin" ? (
          <HrOfficeNetworks />
        ) : null}
        {view === "networks" && user.role !== "admin" ? (
          <section className="rounded-lg border border-[#e4a99f] bg-[#fff3f1] px-5 py-8 text-center text-sm text-[#9d3426]">
            只有 Admin HR 可以管理办公网络。
          </section>
        ) : null}
      </HrAttendanceWorkspace>
    </HrShell>
  );
}
