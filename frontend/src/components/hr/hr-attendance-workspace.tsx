import Link from "next/link";
import type { ReactNode } from "react";
import type { HrUser } from "@/types/hr";

export type HrAttendanceView =
  | "daily"
  | "summary"
  | "calendar"
  | "regions"
  | "networks";

interface HrAttendanceWorkspaceProps {
  view: HrAttendanceView;
  user: HrUser;
  children?: ReactNode;
}

const views: Record<
  HrAttendanceView,
  { href: string; label: string; heading: string }
> = {
  daily: {
    href: "/hr/attendance/daily",
    label: "每日出勤",
    heading: "每日出勤",
  },
  summary: {
    href: "/hr/attendance/summary",
    label: "出勤汇总",
    heading: "出勤汇总",
  },
  calendar: {
    href: "/hr/attendance/calendar",
    label: "工作日历",
    heading: "工作日历",
  },
  regions: {
    href: "/hr/attendance/regions",
    label: "地区权限",
    heading: "地区权限",
  },
  networks: {
    href: "/hr/attendance/networks",
    label: "办公网络",
    heading: "办公网络",
  },
};

export function HrAttendanceWorkspace({
  view,
  user,
  children,
}: HrAttendanceWorkspaceProps) {
  const currentView = views[view];
  const visibleViews = (Object.keys(views) as HrAttendanceView[]).filter(
    (viewKey) =>
      !["regions", "networks"].includes(viewKey) || user.role === "admin",
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col gap-5 border-b border-[#c9d7e3] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#557089]">考勤管理</p>
          <h1 className="mt-1 text-3xl font-semibold text-[#172735]">
            出勤管理
          </h1>
        </div>

        <nav
          aria-label="出勤管理视图"
          className="grid w-full grid-cols-2 rounded-md border border-[#b8cad9] bg-[#e4edf5] p-1 sm:flex sm:w-fit sm:max-w-full sm:flex-wrap"
        >
          {visibleViews.map((viewKey) => {
            const item = views[viewKey];
            const isActive = viewKey === view;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded px-3 py-2 text-center text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#184268]/30 sm:px-4 ${
                  isActive
                    ? "bg-white text-[#184268] shadow-sm"
                    : "text-[#60758a] hover:text-[#184268]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children ? (
        <div className="mt-6">{children}</div>
      ) : (
        <section
          className="mt-6 overflow-hidden rounded-lg border border-[#c9d7e3] bg-white"
          aria-labelledby="attendance-view-heading"
        >
          <header className="border-b border-[#d9e3eb] px-5 py-4 sm:px-6">
            <h2
              id="attendance-view-heading"
              className="text-lg font-semibold text-[#263a4b]"
            >
              {currentView.heading}
            </h2>
          </header>
          <div className="min-h-64 px-5 py-10 sm:px-6">
            <p className="text-center text-sm text-[#6b7f92]">暂无数据</p>
          </div>
        </section>
      )}
    </main>
  );
}
