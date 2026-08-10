"use client";

import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { SelectInput } from "@/components/ui/select-input";
import {
  getWorkLocationSelectOptions,
  WorkLocationLabel,
} from "@/components/ui/work-location-label";
import { listHrUsers } from "@/lib/api/hr-auth";
import {
  listHrAttendanceSummary,
  normalizeHrAttendanceError,
} from "@/lib/api/hr-attendance";
import type { HrUser } from "@/types/hr";
import type {
  HrAttendanceStatusDates,
  HrAttendanceSummaryResponse,
  HrAttendanceSummarySort,
  HrStudentAttendanceSummary,
} from "@/types/hr-attendance";
import type { CheckInMode } from "@/types/attendance";
import type { WorkLocation } from "@/types/student";

interface HrAttendanceSummaryProps {
  user: HrUser;
}

interface SummaryFilters {
  month: string;
  keyword: string;
  workLocation: WorkLocation | "";
  checkInMode: CheckInMode | "";
  ownerHrId: string;
}

const SORT_OPTIONS: Array<{
  value: HrAttendanceSummarySort;
  label: string;
}> = [
  { value: "student_name_asc", label: "按学生姓名" },
  { value: "total_attendance_days_desc", label: "按总出勤天数（较多优先）" },
  { value: "latest_check_in_at_desc", label: "按最近签到时间" },
];

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

function createEmptyResponse(month: string): HrAttendanceSummaryResponse {
  return {
    month,
    items: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  };
}

function formatMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;

  return `${match[1]}年${Number(match[2])}月`;
}

function formatStatusDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  return `${Number(match[2])}/${Number(match[3])}`;
}

function formatChinaDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function StatusDates({
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
    <div aria-label={`${label}${value.count}天`}>
      <p className={`font-semibold ${toneClass}`}>{value.count} 天</p>
      <p
        className="mt-1 break-words text-xs leading-5 text-[#6b7f92]"
        title={value.dates.join("、")}
      >
        {value.dates.length > 0
          ? value.dates.map(formatStatusDate).join("、")
          : "—"}
      </p>
    </div>
  );
}

function AttendanceModes({ summary }: { summary: HrStudentAttendanceSummary }) {
  return (
    <div className="space-y-1 text-xs">
      <p>
        <span className="text-[#6b7f92]">线上</span>{" "}
        <span className="font-semibold text-[#263a4b]">
          {summary.onlineAttendanceDays} 天
        </span>
      </p>
      <p>
        <span className="text-[#6b7f92]">线下</span>{" "}
        <span className="font-semibold text-[#263a4b]">
          {summary.offlineAttendanceDays} 天
        </span>
      </p>
    </div>
  );
}

export function HrAttendanceSummary({ user }: HrAttendanceSummaryProps) {
  const router = useRouter();
  const currentMonth = getChinaCurrentMonth();
  const initialFilters: SummaryFilters = {
    month: currentMonth,
    keyword: "",
    workLocation: "",
    checkInMode: "",
    ownerHrId: "",
  };
  const [draft, setDraft] = useState<SummaryFilters>(initialFilters);
  const [filters, setFilters] = useState<SummaryFilters>(initialFilters);
  const [sortBy, setSortBy] =
    useState<HrAttendanceSummarySort>("student_name_asc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState(() => createEmptyResponse(currentMonth));
  const [hrUsers, setHrUsers] = useState<HrUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [ownerListError, setOwnerListError] = useState("");
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

    void listHrAttendanceSummary({
      month: filters.month,
      page,
      limit,
      keyword: filters.keyword || undefined,
      workLocation: filters.workLocation || undefined,
      checkInMode: filters.checkInMode || undefined,
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
          "无法读取月度出勤汇总，请稍后重试",
        );
        if (requestError.requiresLogin) {
          router.replace("/hr/login");
          return;
        }

        setData(createEmptyResponse(filters.month));
        setErrorMessage(requestError.message);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [filters, isAdmin, limit, page, refreshKey, router, sortBy]);

  function selectMonth(value: Dayjs | null) {
    setDraft((current) => ({
      ...current,
      month: value ? value.format("YYYY-MM") : currentMonth,
    }));
  }

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
  const hasFilters =
    filters.month !== currentMonth ||
    filters.keyword !== "" ||
    filters.workLocation !== "" ||
    filters.checkInMode !== "" ||
    (isAdmin && filters.ownerHrId !== "");

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#203446]">
            月度出勤汇总
          </h2>
          <p className="mt-1 text-sm text-[#6b7f92]">
            {formatMonth(data.month)}，按学生汇总出勤、迟到、请假和缺勤记录。
          </p>
        </div>
        <button
          type="button"
          title="刷新月度出勤汇总"
          aria-label="刷新月度出勤汇总"
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

      <section className="mt-5 rounded-lg border border-[#cfdae4] bg-white">
        <form
          className={`grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5 ${
            isAdmin ? "xl:grid-cols-7" : "xl:grid-cols-6"
          } xl:items-end`}
          onSubmit={submitFilters}
        >
          <div>
            <label className="mb-2 block text-xs font-semibold text-[#52677a]">
              汇总月份
            </label>
            <DatePicker
              picker="month"
              value={dayjs(`${draft.month}-01`)}
              allowClear={false}
              inputReadOnly
              format="YYYY年M月"
              onChange={selectMonth}
              className="app-date-picker min-h-11 w-full"
              aria-label="选择汇总月份"
            />
          </div>

          <div>
            <label
              htmlFor="attendance-summary-keyword"
              className="mb-2 block text-xs font-semibold text-[#52677a]"
            >
              搜索学生
            </label>
            <input
              id="attendance-summary-keyword"
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
              ariaLabel="筛选汇总工作地点"
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
              ariaLabel="筛选汇总签到方式"
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
                ariaLabel="筛选汇总负责 HR"
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

      <section className="mt-5 overflow-hidden rounded-lg border border-[#cfdae4] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#d5e0e9] bg-[#f8fafc] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm text-[#5f7285]">
            共 {data.pagination.total} 名学生
          </p>
          <div className="flex items-center gap-2.5">
            <label
              className="shrink-0 text-sm font-medium text-[#52677a]"
              htmlFor="attendance-summary-sort"
            >
              排序方式
            </label>
            <div className="w-64 max-w-[calc(100vw_-_9rem)]">
              <SelectInput
                id="attendance-summary-sort"
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
                isAdmin ? "min-w-[1240px]" : "min-w-[1130px]"
              }`}
            >
              <colgroup>
                <col className="w-[175px]" />
                {isAdmin ? <col className="w-[105px]" /> : null}
                <col className="w-[105px]" />
                <col className="w-[140px]" />
                <col className="w-[140px]" />
                <col className="w-[140px]" />
                <col className="w-[120px]" />
                <col className="w-[220px]" />
              </colgroup>
              <thead className="bg-[#f3f7fa] text-xs font-semibold text-[#52677a]">
                <tr>
                  <th className="border-b border-[#d5e0e9] px-4 py-3">学生</th>
                  {isAdmin ? (
                    <th className="border-b border-[#d5e0e9] px-3 py-3">
                      负责 HR
                    </th>
                  ) : null}
                  <th className="border-b border-[#d5e0e9] px-3 py-3">
                    总出勤
                  </th>
                  <th className="border-b border-[#d5e0e9] px-3 py-3">迟到</th>
                  <th className="border-b border-[#d5e0e9] px-3 py-3">请假</th>
                  <th className="border-b border-[#d5e0e9] px-3 py-3">缺勤</th>
                  <th className="border-b border-[#d5e0e9] px-3 py-3">
                    线上 / 线下
                  </th>
                  <th className="border-b border-[#d5e0e9] px-3 py-3">
                    最近一次签到
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm text-[#263a4b]">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 8 : 7}
                      className="px-5 py-14 text-center text-[#5f7285]"
                    >
                      正在读取月度出勤汇总...
                    </td>
                  </tr>
                ) : data.items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 8 : 7}
                      className="px-5 py-14 text-center text-[#5f7285]"
                    >
                      {hasFilters
                        ? "没有符合条件的月度出勤记录"
                        : "该月暂无出勤记录"}
                    </td>
                  </tr>
                ) : (
                  data.items.map((item) => (
                    <tr
                      key={item.student.id}
                      className="border-b border-[#e2e9ef] last:border-b-0 hover:bg-[#f8fafc]"
                    >
                      <td className="px-4 py-4 align-top">
                        <Link
                          href={`/hr/attendance/students/${item.student.id}?month=${encodeURIComponent(data.month)}`}
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
                        <p className="text-lg font-semibold text-[#176555]">
                          {item.summary.totalAttendanceDays}
                          <span className="ml-1 text-xs font-medium text-[#6b7f92]">
                            天
                          </span>
                        </p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <StatusDates
                          label="迟到"
                          value={item.summary.late}
                          tone="amber"
                        />
                      </td>
                      <td className="px-3 py-4 align-top">
                        <StatusDates
                          label="请假"
                          value={item.summary.leave}
                          tone="blue"
                        />
                      </td>
                      <td className="px-3 py-4 align-top">
                        <StatusDates
                          label="缺勤"
                          value={item.summary.absent}
                          tone="red"
                        />
                      </td>
                      <td className="px-3 py-4 align-top">
                        <AttendanceModes summary={item.summary} />
                      </td>
                      <td className="px-3 py-4 align-top">
                        {item.summary.latestCheckIn ? (
                          <div>
                            <p className="font-medium text-[#263a4b]">
                              {formatChinaDateTime(
                                item.summary.latestCheckIn.checkInAt,
                              )}
                            </p>
                            <p className="mt-1 text-xs text-[#6b7f92]">
                              {item.summary.latestCheckIn.checkInMode ===
                              "online"
                                ? "线上签到"
                                : "线下签到"}
                            </p>
                            <WorkLocationLabel
                              location={
                                item.summary.latestCheckIn.assignedWorkLocation
                              }
                              className="mt-1"
                              nameClassName="text-xs font-normal text-[#52677a]"
                            />
                            {item.summary.latestCheckIn.checkInLocation &&
                            item.summary.latestCheckIn.checkInLocation !==
                              item.summary.latestCheckIn
                                .assignedWorkLocation ? (
                              <p className="mt-1 break-words text-xs text-[#6b7f92]">
                                签到地点：
                                {item.summary.latestCheckIn.checkInLocation}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[#6b7f92]">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-4 border-t border-[#d5e0e9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-[#5f7285]">
            <label htmlFor="attendance-summary-page-size">每页</label>
            <SelectInput
              id="attendance-summary-page-size"
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
            <span>人</span>
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
    </div>
  );
}
