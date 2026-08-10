"use client";

import { WorkLocationLabel } from "@/components/ui/work-location-label";
import { useStudentAttendanceRecords } from "@/hooks/use-student-attendance-records";
import type {
  AttendanceStatus,
  AttendanceStatusSummary,
  StudentAttendanceRecordItem,
} from "@/types/attendance";
import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Laptop,
  MapPin,
  RefreshCw,
  UserRoundMinus,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

interface StatusPresentation {
  label: string;
  badgeClassName: string;
}

const STATUS_PRESENTATIONS: Record<AttendanceStatus, StatusPresentation> = {
  on_time: {
    label: "已打卡",
    badgeClassName: "border-[#9bd0bd] bg-[#eef9f4] text-[#176555]",
  },
  late: {
    label: "迟到",
    badgeClassName: "border-[#e8c177] bg-[#fff9e9] text-[#8a5a12]",
  },
  leave: {
    label: "请假",
    badgeClassName: "border-[#a9c5da] bg-[#edf4fa] text-[#184268]",
  },
  absent: {
    label: "缺勤",
    badgeClassName: "border-[#e4a99f] bg-[#fff3f1] text-[#9d3426]",
  },
};

function getChinaCurrentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";

  return `${year}-${month}`;
}

function formatAttendanceDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return value;
  }

  const [, , month, day] = match;
  const date = new Date(`${value}T12:00:00+08:00`);
  const weekday = Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("zh-CN", {
        weekday: "short",
        timeZone: "Asia/Shanghai",
      }).format(date);

  return `${Number(month)}月${Number(day)}日${weekday ? ` ${weekday}` : ""}`;
}

function formatCheckInTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function getStatusPresentation(
  item: StudentAttendanceRecordItem,
): StatusPresentation {
  if (item.status === "absent" && item.lateLevel === "severe") {
    return {
      label: "严重迟到（记缺勤）",
      badgeClassName: "border-[#e4a99f] bg-[#fff3f1] text-[#9d3426]",
    };
  }

  return STATUS_PRESENTATIONS[item.status];
}

function formatSummaryDates(summary: AttendanceStatusSummary): string {
  if (summary.dates.length === 0) {
    return "本月暂无";
  }

  return summary.dates
    .map((date) => {
      const [, month, day] = date.split("-");
      return `${Number(month)}/${Number(day)}`;
    })
    .join("、");
}

function SummaryItem({
  label,
  count,
  detail,
  icon,
}: {
  label: string;
  count: number;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="min-h-32 rounded-lg border border-[#d6e1e9] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#6b7f92]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[#172735]">
            {count}
            <span className="ml-1 text-sm font-medium text-[#6b7f92]">天</span>
          </p>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#edf4fa] text-[#184268]">
          {icon}
        </span>
      </div>
      <p className="mt-3 break-words text-xs leading-5 text-[#718496]">
        {detail}
      </p>
    </div>
  );
}

export function StudentAttendanceRecords() {
  const currentMonth = getChinaCurrentMonth();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const {
    records,
    isLoading,
    isRefreshing,
    errorMessage,
    refresh,
  } = useStudentAttendanceRecords(selectedMonth);

  function selectMonth(value: Dayjs | null) {
    if (value) {
      setSelectedMonth(value.format("YYYY-MM"));
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 rounded-lg border border-[#d2dee8] bg-white px-5 py-5 shadow-[0_4px_18px_rgba(24,66,104,0.05)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-[#203446]">我的出勤记录</h2>
          <p className="mt-1 text-sm leading-6 text-[#6b7f92]">
            所有时间均按中国北京时间记录，考勤状态以后端结果为准。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DatePicker
            picker="month"
            value={dayjs(`${selectedMonth}-01`)}
            allowClear={false}
            inputReadOnly
            format="YYYY年M月"
            disabledDate={(date) => date.format("YYYY-MM") > currentMonth}
            onChange={selectMonth}
            className="app-date-picker w-40"
            aria-label="选择出勤记录月份"
          />
          <button
            type="button"
            title="刷新出勤记录"
            aria-label="刷新出勤记录"
            disabled={isRefreshing || isLoading}
            onClick={() => void refresh()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#c5d5e2] bg-white text-[#52708a] transition hover:border-[#184268] hover:bg-[#edf4fa] hover:text-[#184268] focus:outline-none focus:ring-2 focus:ring-[#184268]/20 disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              className={isRefreshing ? "animate-spin" : ""}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {isLoading ? (
        <section
          className="mt-5 rounded-lg border border-[#d2dee8] bg-white px-6 py-12 text-center shadow-[0_4px_18px_rgba(24,66,104,0.05)]"
          aria-live="polite"
        >
          <RefreshCw
            className="mx-auto animate-spin text-[#52708a]"
            size={24}
            aria-hidden="true"
          />
          <p className="mt-3 text-sm text-[#5f7285]">正在读取出勤记录...</p>
        </section>
      ) : errorMessage || !records ? (
        <section className="mt-5 rounded-lg border border-[#e4b7af] bg-white px-6 py-10 text-center shadow-[0_4px_18px_rgba(24,66,104,0.05)]">
          <p className="text-sm text-[#9d3426]" role="alert">
            {errorMessage || "暂时无法读取出勤记录"}
          </p>
          <button
            type="button"
            className="mt-5 rounded-md border border-[#b9c9d7] bg-white px-4 py-2 text-sm font-semibold text-[#184268] transition hover:border-[#184268] hover:bg-[#edf4fa] focus:outline-none focus:ring-2 focus:ring-[#184268]/20"
            onClick={() => void refresh()}
          >
            重新加载
          </button>
        </section>
      ) : (
        <>
          <section
            className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="本月出勤汇总"
          >
            <SummaryItem
              label="总出勤"
              count={records.summary.totalAttendanceDays}
              detail="包括按时打卡和普通迟到"
              icon={<CheckCircle2 size={17} aria-hidden="true" />}
            />
            <SummaryItem
              label="迟到"
              count={records.summary.late.count}
              detail={formatSummaryDates(records.summary.late)}
              icon={<Clock3 size={17} aria-hidden="true" />}
            />
            <SummaryItem
              label="请假"
              count={records.summary.leave.count}
              detail={formatSummaryDates(records.summary.leave)}
              icon={<CalendarDays size={17} aria-hidden="true" />}
            />
            <SummaryItem
              label="缺勤"
              count={records.summary.absent.count}
              detail={formatSummaryDates(records.summary.absent)}
              icon={<UserRoundMinus size={17} aria-hidden="true" />}
            />
            <SummaryItem
              label="线上出勤"
              count={records.summary.onlineAttendanceDays}
              detail="本月有效线上签到"
              icon={<Laptop size={17} aria-hidden="true" />}
            />
            <SummaryItem
              label="线下出勤"
              count={records.summary.offlineAttendanceDays}
              detail="本月有效办公室签到"
              icon={<MapPin size={17} aria-hidden="true" />}
            />
          </section>

          <section className="mt-5 overflow-hidden rounded-lg border border-[#d2dee8] bg-white shadow-[0_4px_18px_rgba(24,66,104,0.05)]">
            <div className="border-b border-[#e0e8ef] px-5 py-4 sm:px-6">
              <h2 className="text-base font-semibold text-[#203446]">
                每日明细
              </h2>
              <p className="mt-1 text-xs text-[#718496]">
                共 {records.items.length} 条考勤记录
              </p>
            </div>

            {records.items.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-[#718496]">
                该月暂无考勤记录
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-left">
                  <thead className="bg-[#f4f8fb] text-xs font-semibold text-[#5c7184]">
                    <tr>
                      <th className="px-5 py-3.5 sm:px-6">日期</th>
                      <th className="px-4 py-3.5">状态</th>
                      <th className="px-4 py-3.5">登记时间</th>
                      <th className="px-4 py-3.5">签到方式</th>
                      <th className="px-5 py-3.5 sm:px-6">工作地点</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3ebf1] text-sm text-[#263a4b]">
                    {records.items.map((item) => {
                      const status = getStatusPresentation(item);

                      return (
                        <tr key={item.attendanceDate}>
                          <td className="whitespace-nowrap px-5 py-4 font-medium sm:px-6">
                            {formatAttendanceDate(item.attendanceDate)}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.badgeClassName}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            {formatCheckInTime(item.checkInAt)}
                          </td>
                          <td className="px-4 py-4">
                            {item.checkInMode === "online"
                              ? "线上签到"
                              : item.checkInMode === "offline"
                                ? "线下签到"
                                : "—"}
                          </td>
                          <td className="px-5 py-4 sm:px-6">
                            <WorkLocationLabel
                              location={item.assignedWorkLocation}
                              nameClassName="text-sm"
                              addressClassName="text-xs"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
