"use client";

import { StudentAttendanceCheckIn } from "@/components/student/student-attendance-check-in";
import { WorkLocationLabel } from "@/components/ui/work-location-label";
import { useStudentAttendanceToday } from "@/hooks/use-student-attendance-today";
import { formatDateTime } from "@/lib/format-date";
import type {
  AttendanceTodayStatus,
  StudentAttendanceTodayResponse,
} from "@/types/attendance";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
} from "lucide-react";

interface StatusPresentation {
  label: string;
  description: string;
  badgeClassName: string;
  accentClassName: string;
}

const STATUS_PRESENTATIONS: Record<
  AttendanceTodayStatus,
  StatusPresentation
> = {
  pending: {
    label: "待登记",
    description: "今天需要完成出勤登记。",
    badgeClassName: "border-[#e8b78f] bg-[#fff7ef] text-[#9a5527]",
    accentClassName: "bg-[#c46b3c]",
  },
  not_required: {
    label: "无需登记",
    description: "今天不需要进行出勤登记。",
    badgeClassName: "border-[#cbd9e4] bg-[#f4f7fa] text-[#52677a]",
    accentClassName: "bg-[#8296a8]",
  },
  on_time: {
    label: "已打卡",
    description: "今天的出勤登记已完成。",
    badgeClassName: "border-[#9bd0bd] bg-[#eef9f4] text-[#176555]",
    accentClassName: "bg-[#2f8a70]",
  },
  late: {
    label: "迟到",
    description: "今天已完成登记，系统记录为迟到。",
    badgeClassName: "border-[#e8c177] bg-[#fff9e9] text-[#8a5a12]",
    accentClassName: "bg-[#c68a2b]",
  },
  leave: {
    label: "请假",
    description: "今天已登记为请假。",
    badgeClassName: "border-[#a9c5da] bg-[#edf4fa] text-[#184268]",
    accentClassName: "bg-[#4d82aa]",
  },
  absent: {
    label: "缺勤",
    description: "今天的考勤状态为缺勤。",
    badgeClassName: "border-[#e4a99f] bg-[#fff3f1] text-[#9d3426]",
    accentClassName: "bg-[#c94f3d]",
  },
};

function getStatusPresentation(
  today: StudentAttendanceTodayResponse,
): StatusPresentation {
  if (today.status !== "not_required") {
    return STATUS_PRESENTATIONS[today.status];
  }

  if (!today.assignedWorkLocation) {
    return {
      label: "待安排",
      description: "今天没有生效的工作地点安排，请联系 HR 确认后再登记出勤。",
      badgeClassName: "border-[#e8b78f] bg-[#fff7ef] text-[#9a5527]",
      accentClassName: "bg-[#c46b3c]",
    };
  }

  if (!today.isWorkday) {
    return {
      label: "今日休息",
      description: "今天是周末或系统安排的休息日，无需登记出勤。",
      badgeClassName: "border-[#cbd9e4] bg-[#f4f7fa] text-[#52677a]",
      accentClassName: "bg-[#8296a8]",
    };
  }

  return STATUS_PRESENTATIONS.not_required;
}

function formatBusinessDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return value;
  }

  const [, year, month, day] = match;
  const date = new Date(`${value}T12:00:00+08:00`);
  const weekday = Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("zh-CN", {
        weekday: "long",
        timeZone: "Asia/Shanghai",
      }).format(date);

  return `${year}年${Number(month)}月${Number(day)}日${weekday ? ` ${weekday}` : ""}`;
}

export function StudentAttendanceDashboard() {
  const {
    today,
    isLoading,
    isRefreshing,
    errorMessage,
    refresh,
  } = useStudentAttendanceToday();

  if (isLoading) {
    return (
      <section
        className="rounded-lg border border-[#d2dee8] bg-white px-6 py-12 text-center shadow-[0_4px_18px_rgba(24,66,104,0.05)]"
        aria-live="polite"
      >
        <RefreshCw
          className="mx-auto animate-spin text-[#52708a]"
          size={24}
          aria-hidden="true"
        />
        <p className="mt-3 text-sm text-[#5f7285]">正在读取今日考勤...</p>
      </section>
    );
  }

  if (errorMessage || !today) {
    return (
      <section className="rounded-lg border border-[#e4b7af] bg-white px-6 py-10 text-center shadow-[0_4px_18px_rgba(24,66,104,0.05)]">
        <p className="text-sm text-[#9d3426]" role="alert">
          {errorMessage || "暂时无法读取今日考勤"}
        </p>
        <button
          type="button"
          className="mt-5 rounded-md border border-[#b9c9d7] bg-white px-4 py-2 text-sm font-semibold text-[#184268] transition hover:border-[#184268] hover:bg-[#edf4fa] focus:outline-none focus:ring-2 focus:ring-[#184268]/20"
          onClick={() => void refresh()}
        >
          重新加载
        </button>
      </section>
    );
  }

  const status = getStatusPresentation(today);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
      <section className="relative overflow-hidden rounded-lg border border-[#d2dee8] bg-white shadow-[0_4px_18px_rgba(24,66,104,0.05)]">
        <div
          className={`absolute inset-y-0 left-0 w-1.5 ${status.accentClassName}`}
          aria-hidden="true"
        />

        <div className="flex flex-col gap-6 px-6 py-7 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#52677a]">
                {formatBusinessDate(today.attendanceDate)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-[#172735] sm:text-3xl">
                  今日考勤
                </h2>
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-semibold ${status.badgeClassName}`}
                >
                  {status.label}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#5f7285]">
                {status.description}
              </p>
            </div>

            <button
              type="button"
              title="刷新今日状态"
              aria-label="刷新今日状态"
              disabled={isRefreshing}
              onClick={() => void refresh()}
              className="grid h-10 w-10 place-items-center rounded-md border border-[#c5d5e2] bg-white text-[#52708a] transition hover:border-[#184268] hover:bg-[#edf4fa] hover:text-[#184268] focus:outline-none focus:ring-2 focus:ring-[#184268]/20 disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={isRefreshing ? "animate-spin" : ""}
                aria-hidden="true"
              />
            </button>
          </div>

          {today.checkInAt ? (
            <div className="flex items-center gap-3 rounded-md bg-[#eef9f4] px-4 py-3 text-sm text-[#176555]">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>
                登记时间：
                <strong className="ml-1 font-semibold">
                  {formatDateTime(today.checkInAt)}
                </strong>
              </span>
            </div>
          ) : null}

          <StudentAttendanceCheckIn
            today={today}
            onStatusRefresh={refresh}
          />
        </div>
      </section>

      <aside className="rounded-lg border border-[#d2dee8] bg-white shadow-[0_4px_18px_rgba(24,66,104,0.05)]">
        <div className="border-b border-[#e0e8ef] px-5 py-4">
          <h2 className="text-base font-semibold text-[#203446]">今日安排</h2>
        </div>
        <dl className="divide-y divide-[#e5ecf2] px-5">
          <div className="py-4">
            <dt className="flex items-center gap-2 text-xs font-medium text-[#6b7f92]">
              <MapPin size={14} aria-hidden="true" />
              工作地点
            </dt>
            <dd className="mt-2 text-sm text-[#263a4b]">
              {today.assignedWorkLocation ? (
                <WorkLocationLabel location={today.assignedWorkLocation} />
              ) : (
                "未安排"
              )}
            </dd>
          </div>
          <div className="py-4">
            <dt className="flex items-center gap-2 text-xs font-medium text-[#6b7f92]">
              <CalendarDays size={14} aria-hidden="true" />
              工作日
            </dt>
            <dd className="mt-2 text-sm font-semibold text-[#263a4b]">
              {!today.assignedWorkLocation
                ? "等待地点安排"
                : today.isWorkday
                  ? "需要出勤"
                  : "今日非工作日"}
            </dd>
          </div>
          <div className="py-4">
            <dt className="flex items-center gap-2 text-xs font-medium text-[#6b7f92]">
              <Clock3 size={14} aria-hidden="true" />
              登记窗口
            </dt>
            <dd className="mt-2 text-sm font-semibold text-[#263a4b]">
              {today.checkInWindow === "open" ? "开放中" : "已关闭"}
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
