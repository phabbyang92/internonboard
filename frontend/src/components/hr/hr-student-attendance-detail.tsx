"use client";

import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { WorkLocationLabel } from "@/components/ui/work-location-label";
import { HrAttendanceCorrectionModal } from "@/components/hr/hr-attendance-correction-modal";
import {
  getHrStudentAttendance,
  normalizeHrAttendanceError,
} from "@/lib/api/hr-attendance";
import type { AttendanceStatus } from "@/types/attendance";
import type { HrUser } from "@/types/hr";
import type {
  HrAttendanceRecordItem,
  HrAttendanceStatusDates,
  HrStudentAttendanceDetailResponse,
} from "@/types/hr-attendance";

interface HrStudentAttendanceDetailProps {
  studentId: string;
  initialMonth?: string;
  user: HrUser;
}

function getChinaCurrentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";

  return `${year}-${month}`;
}

function normalizeMonth(value?: string): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
    ? value
    : getChinaCurrentMonth();
}

function formatMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return match ? `${match[1]}年${Number(match[2])}月` : value;
}

function formatAttendanceDate(value: string, includeWeekday = true): string {
  const date = new Date(`${value}T12:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: includeWeekday ? "short" : undefined,
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function formatChinaDateTime(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function formatDateRangeDate(value: string | null): string {
  if (!value) return "未设置";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未设置";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function getStatusPresentation(item: HrAttendanceRecordItem) {
  if (item.status === "absent" && item.lateLevel === "severe") {
    return {
      label: "严重迟到（缺勤）",
      className: "border-[#e4a99f] bg-[#fff3f1] text-[#9d3426]",
    };
  }

  const presentations: Record<
    AttendanceStatus,
    { label: string; className: string }
  > = {
    on_time: {
      label: "按时",
      className: "border-[#9bd0bd] bg-[#eef9f4] text-[#176555]",
    },
    late: {
      label: "迟到",
      className: "border-[#e8c177] bg-[#fff9e9] text-[#8a5a12]",
    },
    leave: {
      label: "请假",
      className: "border-[#a9c5da] bg-[#edf4fa] text-[#184268]",
    },
    absent: {
      label: "缺勤",
      className: "border-[#e4a99f] bg-[#fff3f1] text-[#9d3426]",
    },
  };

  return presentations[item.status];
}

function getSourceLabel(item: HrAttendanceRecordItem): string {
  if (item.correction) return "HR 已更正";

  return {
    check_in: "学生签到",
    leave_registration: "请假登记",
    absence_scheduler: "系统缺勤",
    hr_correction: "HR 补录",
  }[item.source];
}

function StatusDatesMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: HrAttendanceStatusDates;
  tone: "amber" | "blue" | "red";
}) {
  const toneClass = {
    amber: "text-[#8a5a12]",
    blue: "text-[#184268]",
    red: "text-[#9d3426]",
  }[tone];

  return (
    <div className="min-w-0 px-5 py-4" aria-label={`${label}${value.count}天`}>
      <p className="text-xs font-medium text-[#6b7f92]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>
        {value.count}
        <span className="ml-1 text-sm font-medium">天</span>
      </p>
      <p className="mt-2 break-words text-xs leading-5 text-[#6b7f92]">
        {value.dates.length > 0
          ? value.dates
              .map((date) => formatAttendanceDate(date, false))
              .join("、")
          : "本月无记录"}
      </p>
    </div>
  );
}

export function HrStudentAttendanceDetail({
  studentId,
  initialMonth,
  user,
}: HrStudentAttendanceDetailProps) {
  const router = useRouter();
  const [month, setMonth] = useState(() => normalizeMonth(initialMonth));
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<HrStudentAttendanceDetailResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedRecord, setSelectedRecord] =
    useState<HrAttendanceRecordItem | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    void getHrStudentAttendance(studentId, month)
      .then((response) => {
        if (isActive) setData(response);
      })
      .catch((error: unknown) => {
        if (!isActive) return;

        const requestError = normalizeHrAttendanceError(
          error,
          "无法读取该学生的考勤详情，请稍后重试",
        );
        if (requestError.requiresLogin) {
          router.replace("/hr/login");
          return;
        }

        setData(null);
        setErrorMessage(requestError.message);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [month, refreshKey, router, studentId]);

  useEffect(() => {
    if (!successMessage) return;

    const timeoutId = window.setTimeout(() => setSuccessMessage(""), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  function selectMonth(value: Dayjs | null) {
    if (!value) return;

    setIsLoading(true);
    setErrorMessage("");
    setMonth(value.format("YYYY-MM"));
  }

  const latestCheckIn = data?.summary.latestCheckIn ?? null;

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            href={`/hr/attendance/summary?month=${encodeURIComponent(month)}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#b9c9d7] bg-white px-3 text-sm font-medium text-[#184268] shadow-sm transition hover:border-[#184268] hover:bg-[#f8fbfd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#184268]"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            返回出勤汇总
          </Link>
          <p className="mt-6 text-sm font-semibold text-[#4d6579]">
            学生考勤详情
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-[#172735]">
            {data?.student.name ?? (isLoading ? "正在读取..." : "考勤详情")}
          </h1>
          {data ? (
            <p className="mt-2 break-all text-sm text-[#60758a]">
              {data.student.email}
              {data.student.phone ? ` · ${data.student.phone}` : ""}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#52677a]">
              查看月份
            </span>
            <DatePicker
              picker="month"
              allowClear={false}
              value={dayjs(`${month}-01`)}
              format="YYYY年M月"
              onChange={selectMonth}
              aria-label="选择学生考勤月份"
              className="min-h-10 w-40 rounded-md border-[#b9c9d7]"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setErrorMessage("");
              setRefreshKey((current) => current + 1);
            }}
            disabled={isLoading}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#b9c9d7] bg-white px-3 text-sm font-medium text-[#30475b] transition hover:border-[#184268] hover:text-[#184268] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              aria-hidden="true"
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            刷新
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-[#e4a99f] bg-[#fff3f1] px-4 py-3 text-sm text-[#9d3426]"
        >
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div
          role="status"
          className="mt-6 rounded-lg border border-[#9bd0bd] bg-[#eef9f4] px-4 py-3 text-sm font-medium text-[#176555]"
        >
          {successMessage}
        </div>
      ) : null}

      {data ? (
        <>
          <section className="mt-7 overflow-hidden rounded-lg border border-[#cfdae4] bg-white">
            <div className="grid divide-y divide-[#e2e9ef] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-[#6b7f92]">负责 HR</p>
                <p className="mt-1 font-semibold text-[#263a4b]">
                  {data.student.ownerHr.name}
                </p>
                {user.role === "admin" ? (
                  <p className="mt-1 text-xs text-[#6b7f92]">管理员可跨 HR 查看</p>
                ) : null}
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-[#6b7f92]">当前工作地点</p>
                <div className="mt-1">
                  {data.student.currentWorkLocation ? (
                    <WorkLocationLabel
                      location={data.student.currentWorkLocation}
                      nameClassName="text-sm text-[#263a4b]"
                    />
                  ) : (
                    <p className="font-semibold text-[#263a4b]">未安排</p>
                  )}
                </div>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-[#6b7f92]">实习开始日期</p>
                <p className="mt-1 font-semibold text-[#263a4b]">
                  {formatDateRangeDate(data.student.onboardingStartAt)}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-[#6b7f92]">实习结束日期</p>
                <p className="mt-1 font-semibold text-[#263a4b]">
                  {formatDateRangeDate(data.student.onboardingEndAt)}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6 overflow-hidden rounded-lg border border-[#cfdae4] bg-white">
            <div className="border-b border-[#d5e0e9] px-5 py-4">
              <h2 className="text-lg font-semibold text-[#263a4b]">
                {formatMonth(data.month)}累计
              </h2>
              <p className="mt-1 text-sm text-[#6b7f92]">
                出勤、迟到、请假和缺勤均按北京时间统计。
              </p>
            </div>
            <div className="grid divide-y divide-[#e2e9ef] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-6">
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-[#6b7f92]">总出勤天数</p>
                <p className="mt-1 text-2xl font-semibold text-[#176555]">
                  {data.summary.totalAttendanceDays}
                  <span className="ml-1 text-sm font-medium">天</span>
                </p>
                <p className="mt-2 text-xs text-[#6b7f92]">按时与迟到签到</p>
              </div>
              <StatusDatesMetric
                label="迟到"
                value={data.summary.late}
                tone="amber"
              />
              <StatusDatesMetric
                label="请假"
                value={data.summary.leave}
                tone="blue"
              />
              <StatusDatesMetric
                label="缺勤"
                value={data.summary.absent}
                tone="red"
              />
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-[#6b7f92]">线上出勤</p>
                <p className="mt-1 text-2xl font-semibold text-[#184268]">
                  {data.summary.onlineAttendanceDays}
                  <span className="ml-1 text-sm font-medium">天</span>
                </p>
                <p className="mt-2 text-xs text-[#6b7f92]">学生选择线上签到</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-[#6b7f92]">线下出勤</p>
                <p className="mt-1 text-2xl font-semibold text-[#184268]">
                  {data.summary.offlineAttendanceDays}
                  <span className="ml-1 text-sm font-medium">天</span>
                </p>
                <p className="mt-2 text-xs text-[#6b7f92]">办公室网络签到</p>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-[#cfdae4] bg-white px-5 py-4">
            <h2 className="text-base font-semibold text-[#263a4b]">
              最近一次签到
            </h2>
            {latestCheckIn ? (
              <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-[#6b7f92]">签到时间</p>
                  <p className="mt-1 font-medium text-[#263a4b]">
                    {formatChinaDateTime(latestCheckIn.checkInAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#6b7f92]">签到方式</p>
                  <p className="mt-1 font-medium text-[#263a4b]">
                    {latestCheckIn.checkInMode === "online"
                      ? "线上签到"
                      : "线下签到"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#6b7f92]">当天安排地点</p>
                  <div className="mt-1">
                    <WorkLocationLabel
                      location={latestCheckIn.assignedWorkLocation}
                      nameClassName="text-sm text-[#263a4b]"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#6b7f92]">实际签到地点</p>
                  <p className="mt-1 font-medium text-[#263a4b]">
                    {latestCheckIn.checkInLocation ?? "—"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#6b7f92]">本月暂无签到记录。</p>
            )}
          </section>

          <section className="mt-6 overflow-hidden rounded-lg border border-[#cfdae4] bg-white">
            <div className="border-b border-[#d5e0e9] px-5 py-4">
              <h2 className="text-lg font-semibold text-[#263a4b]">每日记录</h2>
              <p className="mt-1 text-sm text-[#6b7f92]">
                共 {data.items.length} 条记录，按日期从早到晚排列。
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1040px] w-full border-collapse text-left">
                <thead className="bg-[#f4f7fa] text-xs font-semibold text-[#52677a]">
                  <tr>
                    <th className="px-4 py-3">日期</th>
                    <th className="px-3 py-3">状态</th>
                    <th className="px-3 py-3">签到时间</th>
                    <th className="px-3 py-3">安排地点</th>
                    <th className="px-3 py-3">签到方式 / 地点</th>
                    <th className="px-3 py-3">来源</th>
                    <th className="px-3 py-3">更正信息</th>
                    <th className="px-3 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-[#263a4b]">
                  {data.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-14 text-center text-[#5f7285]"
                      >
                        该月暂无考勤记录
                      </td>
                    </tr>
                  ) : (
                    data.items.map((item) => {
                      const status = getStatusPresentation(item);

                      return (
                        <tr
                          key={item.id}
                          className="border-b border-[#e2e9ef] last:border-b-0 hover:bg-[#f8fafc]"
                        >
                          <td className="whitespace-nowrap px-4 py-4 align-top font-medium">
                            {formatAttendanceDate(item.attendanceDate)}
                          </td>
                          <td className="px-3 py-4 align-top">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 align-top">
                            {formatChinaDateTime(item.checkInAt)}
                          </td>
                          <td className="px-3 py-4 align-top">
                            <WorkLocationLabel
                              location={item.assignedWorkLocation}
                              nameClassName="text-sm text-[#31485c]"
                            />
                          </td>
                          <td className="px-3 py-4 align-top">
                            <p>
                              {item.checkInMode === "online"
                                ? "线上签到"
                                : item.checkInMode === "offline"
                                  ? "线下签到"
                                  : "—"}
                            </p>
                            {item.checkInLocation ? (
                              <p className="mt-1 text-xs text-[#6b7f92]">
                                {item.checkInLocation}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-4 align-top">
                            <span
                              className={
                                item.correction
                                  ? "font-medium text-[#8a5a12]"
                                  : "text-[#52677a]"
                              }
                            >
                              {getSourceLabel(item)}
                            </span>
                          </td>
                          <td className="max-w-64 px-3 py-4 align-top">
                            {item.correction ? (
                              <div>
                                <p className="break-words text-[#425a6e]">
                                  {item.correction.reason}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-[#6b7f92]">
                                  {formatChinaDateTime(item.correction.correctedAt)}
                                  {item.correction.count > 1
                                    ? ` · 共更正 ${item.correction.count} 次`
                                    : ""}
                                </p>
                              </div>
                            ) : (
                              <span className="text-[#8a9aa8]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-4 align-top">
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(item)}
                              className="min-h-9 cursor-pointer whitespace-nowrap rounded-md border border-[#9db8cf] bg-white px-3 text-xs font-semibold text-[#184268] transition hover:border-[#184268] hover:bg-[#f3f8fc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#184268]"
                            >
                              更正
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : isLoading ? (
        <div
          className="mt-7 rounded-lg border border-[#cfdae4] bg-white px-5 py-16 text-center text-sm text-[#5f7285]"
          role="status"
        >
          正在读取学生考勤详情...
        </div>
      ) : null}

      <HrAttendanceCorrectionModal
        isOpen={selectedRecord !== null}
        studentId={studentId}
        studentName={data?.student.name ?? "该学生"}
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onSaved={(message) => {
          setSelectedRecord(null);
          setSuccessMessage(message);
          setIsLoading(true);
          setErrorMessage("");
          setRefreshKey((current) => current + 1);
        }}
      />
    </main>
  );
}
