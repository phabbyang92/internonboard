"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";

import { HrAttendanceCorrectionModal } from "@/components/hr/hr-attendance-correction-modal";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { SelectInput } from "@/components/ui/select-input";
import {
  getWorkLocationSelectOptions,
  WorkLocationLabel,
} from "@/components/ui/work-location-label";
import { listHrUsers } from "@/lib/api/hr-auth";
import {
  listHrDailyAttendance,
  normalizeHrAttendanceError,
} from "@/lib/api/hr-attendance";
import { getChinaTodayInput } from "@/lib/format-date";
import type { HrUser } from "@/types/hr";
import type {
  HrDailyAttendanceItem,
  HrDailyAttendanceResponse,
  HrDailyAttendanceSort,
} from "@/types/hr-attendance";
import type {
  AttendanceStatus,
  CheckInMode,
} from "@/types/attendance";
import type { WorkLocation } from "@/types/student";

interface HrDailyAttendanceProps {
  user: HrUser;
}

interface DailyFilters {
  date: string;
  keyword: string;
  workLocation: WorkLocation | "";
  checkInMode: CheckInMode | "";
  status: AttendanceStatus | "";
  ownerHrId: string;
}

const STATUS_OPTIONS: Array<{ value: AttendanceStatus | ""; label: string }> = [
  { value: "", label: "全部状态" },
  { value: "on_time", label: "按时" },
  { value: "late", label: "迟到" },
  { value: "leave", label: "请假" },
  { value: "absent", label: "缺勤" },
];

const SORT_OPTIONS: Array<{ value: HrDailyAttendanceSort; label: string }> = [
  { value: "student_name_asc", label: "按学生姓名" },
  { value: "check_in_at_asc", label: "按签到时间（较早优先）" },
  { value: "check_in_at_desc", label: "按签到时间（较晚优先）" },
];

function createEmptyResponse(date: string): HrDailyAttendanceResponse {
  return {
    attendanceDate: date,
    summary: {
      totalStudents: 0,
      checkedIn: 0,
      onTime: 0,
      late: 0,
      leave: 0,
      absent: 0,
    },
    items: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  };
}

function formatChinaTime(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function formatAttendanceDate(value: string): string {
  const date = new Date(`${value}T12:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function getStatusPresentation(item: HrDailyAttendanceItem) {
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

function getSourceLabel(item: HrDailyAttendanceItem): string {
  if (item.correction) return "HR 已更正";

  return {
    check_in: "学生签到",
    leave_registration: "请假登记",
    absence_scheduler: "系统缺勤",
    hr_correction: "HR 补录",
  }[item.source];
}

export function HrDailyAttendance({ user }: HrDailyAttendanceProps) {
  const router = useRouter();
  const today = getChinaTodayInput();
  const initialFilters: DailyFilters = {
    date: today,
    keyword: "",
    workLocation: "",
    checkInMode: "",
    status: "",
    ownerHrId: "",
  };
  const [draft, setDraft] = useState<DailyFilters>(initialFilters);
  const [filters, setFilters] = useState<DailyFilters>(initialFilters);
  const [sortBy, setSortBy] =
    useState<HrDailyAttendanceSort>("student_name_asc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState(() => createEmptyResponse(today));
  const [hrUsers, setHrUsers] = useState<HrUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [ownerListError, setOwnerListError] = useState("");
  const [selectedItem, setSelectedItem] =
    useState<HrDailyAttendanceItem | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const isAdmin = user.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;

    let isActive = true;
    void listHrUsers()
      .then(({ items }) => {
        if (isActive) setHrUsers(items);
      })
      .catch(() => {
        if (isActive) setOwnerListError("无法读取 HR 筛选列表");
      });

    return () => {
      isActive = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    let isActive = true;

    void listHrDailyAttendance({
      date: filters.date,
      page,
      limit,
      keyword: filters.keyword || undefined,
      workLocation: filters.workLocation || undefined,
      checkInMode: filters.checkInMode || undefined,
      status: filters.status || undefined,
      ownerHrId: isAdmin ? filters.ownerHrId || undefined : undefined,
      sortBy,
    })
      .then((response) => {
        if (isActive) setData(response);
      })
      .catch((error: unknown) => {
        if (!isActive) return;

        const requestError = normalizeHrAttendanceError(
          error,
          "无法读取每日考勤，请稍后重试",
        );
        if (requestError.requiresLogin) {
          router.replace("/hr/login");
          return;
        }

        setData(createEmptyResponse(filters.date));
        setErrorMessage(requestError.message);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [filters, isAdmin, limit, page, refreshKey, router, sortBy]);

  useEffect(() => {
    if (!successMessage) return;

    const timeoutId = window.setTimeout(() => setSuccessMessage(""), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    setPage(1);
    setFilters({ ...draft, keyword: draft.keyword.trim() });
  }

  function clearFilters() {
    const cleared = { ...initialFilters };
    setIsLoading(true);
    setErrorMessage("");
    setDraft(cleared);
    setFilters(cleared);
    setPage(1);
  }

  const pageCount = Math.max(1, data.pagination.totalPages);
  const summaryItems = [
    { label: "全部学生", value: data.summary.totalStudents, tone: "default" },
    { label: "已打卡", value: data.summary.checkedIn, tone: "blue" },
    { label: "按时", value: data.summary.onTime, tone: "green" },
    { label: "迟到", value: data.summary.late, tone: "amber" },
    { label: "请假", value: data.summary.leave, tone: "blue" },
    { label: "缺勤", value: data.summary.absent, tone: "red" },
  ] as const;
  const toneClasses = {
    default: "text-[#172735]",
    blue: "text-[#184268]",
    green: "text-[#176555]",
    amber: "text-[#8a5a12]",
    red: "text-[#9d3426]",
  };
  const hasFilters =
    filters.date !== today ||
    filters.keyword !== "" ||
    filters.workLocation !== "" ||
    filters.checkInMode !== "" ||
    filters.status !== "" ||
    (isAdmin && filters.ownerHrId !== "");

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#203446]">每日出勤</h2>
          <p className="mt-1 text-sm text-[#6b7f92]">
            {formatAttendanceDate(data.attendanceDate)}
          </p>
        </div>
        <button
          type="button"
          title="刷新每日出勤"
          aria-label="刷新每日出勤"
          disabled={isLoading}
          onClick={() => {
            setIsLoading(true);
            setErrorMessage("");
            setRefreshKey((current) => current + 1);
          }}
          className="grid h-11 w-11 place-items-center self-start rounded-md border border-[#b9c9d7] bg-white text-[#52708a] transition hover:border-[#184268] hover:bg-[#edf4fa] hover:text-[#184268] focus:outline-none focus:ring-2 focus:ring-[#184268]/20 disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw
            size={17}
            className={isLoading ? "animate-spin" : ""}
            aria-hidden="true"
          />
        </button>
      </div>

      <section
        className="mt-5 grid overflow-hidden rounded-lg border border-[#cfdae4] bg-white sm:grid-cols-3 lg:grid-cols-6"
        aria-label="每日出勤统计"
      >
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="min-h-24 border-b border-[#d9e3eb] px-4 py-4 last:border-b-0 sm:border-r sm:[&:nth-child(3n)]:border-r-0 lg:border-b-0 lg:[&:nth-child(3n)]:border-r lg:last:border-r-0"
          >
            <p className="text-xs font-semibold text-[#6b7f92]">
              {item.label}
            </p>
            <p
              className={`mt-2 text-2xl font-semibold ${toneClasses[item.tone]}`}
            >
              {isLoading ? "—" : item.value}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-5 rounded-lg border border-[#cfdae4] bg-white">
        <form
          className={`grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5 ${
            isAdmin ? "xl:grid-cols-8" : "xl:grid-cols-7"
          } xl:items-end`}
          onSubmit={submitFilters}
        >
          <div>
            <label
              htmlFor="attendance-date"
              className="mb-2 block text-xs font-semibold text-[#52677a]"
            >
              考勤日期
            </label>
            <DatePickerInput
              id="attendance-date"
              value={draft.date}
              required
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  date: event.target.value,
                }))
              }
              className="min-h-11"
            />
          </div>

          <div>
            <label
              htmlFor="attendance-keyword"
              className="mb-2 block text-xs font-semibold text-[#52677a]"
            >
              搜索学生
            </label>
            <input
              id="attendance-keyword"
              type="search"
              maxLength={100}
              value={draft.keyword}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  keyword: event.target.value,
                }))
              }
              placeholder="姓名、邮箱或手机号"
              className="h-11 w-full rounded-md border border-[#b9c9d7] px-3 text-sm outline-none focus:border-[#184268] focus:ring-2 focus:ring-[#184268]/15"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-[#52677a]">
              工作地点
            </label>
            <SelectInput
              value={draft.workLocation || undefined}
              placeholder="全部地点"
              options={[
                { value: "", label: "全部地点" },
                ...getWorkLocationSelectOptions(),
              ]}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  workLocation: value as WorkLocation | "",
                }))
              }
              ariaLabel="筛选工作地点"
              className="work-location-select min-h-11"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-[#52677a]">
              签到方式
            </label>
            <SelectInput
              value={draft.checkInMode || undefined}
              placeholder="全部方式"
              options={[
                { value: "", label: "全部方式" },
                { value: "online", label: "线上签到" },
                { value: "offline", label: "线下签到" },
              ]}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  checkInMode: value as CheckInMode | "",
                }))
              }
              ariaLabel="筛选签到方式"
              className="min-h-11"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-[#52677a]">
              考勤状态
            </label>
            <SelectInput
              value={draft.status || undefined}
              placeholder="全部状态"
              options={STATUS_OPTIONS}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  status: value as AttendanceStatus | "",
                }))
              }
              ariaLabel="筛选考勤状态"
              className="min-h-11"
            />
          </div>

          {isAdmin ? (
            <div>
              <label className="mb-2 block text-xs font-semibold text-[#52677a]">
                负责 HR
              </label>
              <SelectInput
                value={draft.ownerHrId || undefined}
                placeholder="全部 HR"
                options={[
                  { value: "", label: "全部 HR" },
                  ...hrUsers.map((hrUser) => ({
                    value: hrUser.id,
                    label: hrUser.name,
                  })),
                ]}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    ownerHrId: value,
                  }))
                }
                ariaLabel="筛选负责 HR"
                className="min-h-11"
              />
              {ownerListError ? (
                <p className="mt-1 text-xs text-[#9d3426]" role="alert">
                  {ownerListError}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex gap-2 sm:col-span-2 xl:col-span-2">
            <button
              type="submit"
              className="h-11 flex-1 rounded-md bg-[#184268] px-4 text-sm font-semibold text-white transition hover:bg-[#123653] focus:outline-none focus:ring-2 focus:ring-[#184268]/25"
            >
              查询
            </button>
            <button
              type="button"
              disabled={!hasFilters && draft.keyword === ""}
              onClick={clearFilters}
              className="h-11 flex-1 rounded-md border border-[#b9c9d7] px-4 text-sm font-medium text-[#52677a] transition hover:border-[#184268] hover:text-[#184268] disabled:cursor-not-allowed disabled:opacity-45"
            >
              清除
            </button>
          </div>
        </form>
      </section>

      {successMessage ? (
        <div
          className="mt-5 rounded-md border border-[#9bd0bd] bg-[#eef9f4] px-4 py-3 text-sm font-medium text-[#176555]"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-lg border border-[#cfdae4] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#d5e0e9] bg-[#f8fafc] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm text-[#5f7285]">
            共 {data.pagination.total} 条记录
          </p>
          <div className="flex items-center gap-2.5">
            <label
              className="shrink-0 text-sm font-medium text-[#52677a]"
              htmlFor="attendance-sort"
            >
              排序方式
            </label>
            <div className="w-64 max-w-[calc(100vw_-_9rem)]">
              <SelectInput
                id="attendance-sort"
                value={sortBy}
                options={SORT_OPTIONS}
                onChange={(value) => {
                  setIsLoading(true);
                  setErrorMessage("");
                  setSortBy(value);
                  setPage(1);
                }}
                className="min-h-10"
              />
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[#9d3426]" role="alert">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setErrorMessage("");
                setRefreshKey((current) => current + 1);
              }}
              className="mt-4 rounded-md border border-[#b9c9d7] px-4 py-2 text-sm font-semibold text-[#184268] hover:border-[#184268] hover:bg-[#edf4fa]"
            >
              重新加载
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className={`w-full table-fixed border-collapse text-left ${
                isAdmin ? "min-w-[1210px]" : "min-w-[1100px]"
              }`}
            >
              <colgroup>
                <col className="w-[170px]" />
                {isAdmin ? <col className="w-28" /> : null}
                <col className="w-[145px]" />
                <col className="w-28" />
                <col className="w-[205px]" />
                <col className="w-[155px]" />
                <col className="w-28" />
                <col className="w-24" />
              </colgroup>
              <thead className="bg-[#f3f7fa] text-xs font-semibold text-[#52677a]">
                <tr>
                  <th className="border-b border-[#d5e0e9] px-4 py-3">学生</th>
                  {isAdmin ? (
                    <th className="border-b border-[#d5e0e9] px-3 py-3">
                      负责 HR
                    </th>
                  ) : null}
                  <th className="border-b border-[#d5e0e9] px-3 py-3">状态</th>
                  <th className="border-b border-[#d5e0e9] px-3 py-3">
                    登记时间
                  </th>
                  <th className="border-b border-[#d5e0e9] px-3 py-3">
                    安排地点
                  </th>
                  <th className="border-b border-[#d5e0e9] px-3 py-3">
                    签到方式 / 地点
                  </th>
                  <th className="border-b border-[#d5e0e9] px-3 py-3">来源</th>
                  <th className="border-b border-[#d5e0e9] px-3 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="text-sm text-[#263a4b]">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 8 : 7}
                      className="px-5 py-14 text-center text-[#5f7285]"
                    >
                      正在读取每日考勤...
                    </td>
                  </tr>
                ) : data.items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 8 : 7}
                      className="px-5 py-14 text-center text-[#5f7285]"
                    >
                      {hasFilters ? "没有符合条件的考勤记录" : "当天暂无考勤记录"}
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
                        <td className="px-4 py-4 align-top">
                          <Link
                            href={`/hr/students/${item.student.id}`}
                            className="font-semibold text-[#243648] transition hover:text-[#006eb6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#184268]"
                          >
                            {item.student.name}
                          </Link>
                          <p className="mt-1 break-all text-xs leading-5 text-[#6b7f92]">
                            {item.student.email}
                          </p>
                        </td>
                        {isAdmin ? (
                          <td className="px-3 py-4 align-top text-[#425a6e]">
                            {item.student.ownerHr.name}
                          </td>
                        ) : null}
                        <td className="px-3 py-4 align-top">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 align-top">
                          {formatChinaTime(item.checkInAt)}
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
                        <td className="px-3 py-4 align-top">
                          <button
                            type="button"
                            onClick={() => setSelectedItem(item)}
                            className="min-h-9 cursor-pointer rounded-md border border-[#a9bfd2] px-3 text-sm font-semibold text-[#184268] transition hover:border-[#184268] hover:bg-[#edf4fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#184268]"
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
        )}

        <div className="flex flex-col gap-4 border-t border-[#d5e0e9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-[#5f7285]">
            <label htmlFor="attendance-page-size">每页</label>
            <SelectInput
              id="attendance-page-size"
              value={limit}
              options={[
                { value: 20, label: "20" },
                { value: 50, label: "50" },
                { value: 100, label: "100" },
              ]}
              onChange={(value) => {
                setIsLoading(true);
                setErrorMessage("");
                setLimit(Number(value));
                setPage(1);
              }}
              className="min-h-9 w-20"
            />
            <span>条</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => {
                setIsLoading(true);
                setErrorMessage("");
                setPage((current) => Math.max(1, current - 1));
              }}
              className="min-h-10 rounded-md border border-[#b9c9d7] px-4 text-sm font-medium text-[#425a6e] disabled:cursor-not-allowed disabled:opacity-45"
            >
              上一页
            </button>
            <span className="min-w-24 text-center text-sm text-[#5f7285]">
              第 {data.pagination.page} / {pageCount} 页
            </span>
            <button
              type="button"
              disabled={page >= pageCount || isLoading}
              onClick={() => {
                setIsLoading(true);
                setErrorMessage("");
                setPage((current) => current + 1);
              }}
              className="min-h-10 rounded-md border border-[#b9c9d7] px-4 text-sm font-medium text-[#425a6e] disabled:cursor-not-allowed disabled:opacity-45"
            >
              下一页
            </button>
          </div>
        </div>
      </section>

      <HrAttendanceCorrectionModal
        isOpen={selectedItem !== null}
        studentId={selectedItem?.student.id ?? ""}
        studentName={selectedItem?.student.name ?? ""}
        record={selectedItem}
        onClose={() => setSelectedItem(null)}
        onSaved={(message) => {
          setSelectedItem(null);
          setSuccessMessage(message);
          setIsLoading(true);
          setErrorMessage("");
          setRefreshKey((current) => current + 1);
        }}
      />
    </div>
  );
}
