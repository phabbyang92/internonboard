"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { HrBatchArrangementModal } from "@/components/hr/hr-batch-arrangement-modal";
import { HrCreateStudentModal } from "@/components/hr/hr-create-student-modal";
import { HrSingleArrangementModal } from "@/components/hr/hr-single-arrangement-modal";
import { OnboardingStatusBadge } from "@/components/hr/onboarding-status-badge";
import { ApiError } from "@/lib/api/client";
import { listHrStudents } from "@/lib/api/hr-students";
import { formatDateOnly, formatDateTime } from "@/lib/format-date";
import type {
  FormSubmissionStatus,
  HrStudentListItem,
  HrStudentListResponse,
} from "@/types/hr";
import {
  WORK_LOCATIONS,
  type OnboardingStatus,
  type WorkLocation,
} from "@/types/student";

const emptyResponse: HrStudentListResponse = {
  items: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  stats: { all: 0, notSubmitted: 0, pendingOnboarding: 0, onboarded: 0 },
};

export function HrStudentList() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<OnboardingStatus | "">("");
  const [workLocation, setWorkLocation] = useState<WorkLocation | "">("");
  const [formStatus, setFormStatus] = useState<FormSubmissionStatus | "">("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<HrStudentListResponse>(emptyResponse);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [arrangingStudent, setArrangingStudent] =
    useState<HrStudentListItem | null>(null);

  useEffect(() => {
    let isActive = true;

    void listHrStudents({
      page,
      limit,
      keyword,
      status,
      workLocation,
      formStatus,
    })
      .then((response) => {
        if (isActive) {
          setData(response);
        }
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        if (error instanceof ApiError && error.statusCode === 401) {
          router.replace("/hr/login");
          return;
        }

        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "无法读取学生列表，请稍后重试",
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [formStatus, keyword, limit, page, refreshKey, router, status, workLocation]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    setPage(1);
    setKeyword(searchInput.trim());
    setSelectedIds([]);
    setRefreshKey((current) => current + 1);
  }

  function clearFilters() {
    setIsLoading(true);
    setErrorMessage("");
    setSearchInput("");
    setKeyword("");
    setStatus("");
    setWorkLocation("");
    setFormStatus("");
    setSelectedIds([]);
    setPage(1);
    setRefreshKey((current) => current + 1);
  }

  const pageCount = Math.max(1, data.pagination.totalPages);
  const hasFilters =
    keyword !== "" ||
    status !== "" ||
    workLocation !== "" ||
    formStatus !== "";
  const selectableItems = data.items.filter(
    (student) => student.onboardingStatus !== "onboarded",
  );
  const allPageItemsSelected =
    selectableItems.length > 0 &&
    selectableItems.every((student) => selectedIds.includes(student.id));

  function refreshList() {
    setIsLoading(true);
    setErrorMessage("");
    setRefreshKey((current) => current + 1);
  }

  function togglePageSelection() {
    if (allPageItemsSelected) {
      const pageIds = new Set(selectableItems.map((student) => student.id));
      setSelectedIds((ids) => ids.filter((id) => !pageIds.has(id)));
      return;
    }

    setSelectedIds((ids) => [
      ...new Set([...ids, ...selectableItems.map((student) => student.id)]),
    ]);
  }

  function applyQuickFilter(
    nextStatus: OnboardingStatus | "",
    nextFormStatus: FormSubmissionStatus | "",
  ) {
    setIsLoading(true);
    setErrorMessage("");
    setSearchInput("");
    setKeyword("");
    setStatus(nextStatus);
    setWorkLocation("");
    setFormStatus(nextFormStatus);
    setSelectedIds([]);
    setPage(1);
  }

  const summaryItems = [
    {
      label: "全部学生",
      value: data.stats.all,
      description: "当前有效记录",
      isActive: !hasFilters,
      onClick: () => applyQuickFilter("", ""),
    },
    {
      label: "待填写",
      value: data.stats.notSubmitted,
      description: "尚未提交登记表",
      isActive:
        formStatus === "not_submitted" &&
        status === "" &&
        workLocation === "" &&
        keyword === "",
      onClick: () => applyQuickFilter("", "not_submitted"),
    },
    {
      label: "待入职",
      value: data.stats.pendingOnboarding,
      description: "已安排开始日期",
      isActive:
        status === "pending_onboarding" &&
        formStatus === "" &&
        workLocation === "" &&
        keyword === "",
      onClick: () => applyQuickFilter("pending_onboarding", ""),
    },
    {
      label: "已入职",
      value: data.stats.onboarded,
      description: "已到入职日期",
      isActive:
        status === "onboarded" &&
        formStatus === "" &&
        workLocation === "" &&
        keyword === "",
      onClick: () => applyQuickFilter("onboarded", ""),
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
      <div className="flex flex-col gap-4 border-b border-[#c8d6e1] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#184268]">学生管理</p>
          <h1 className="mt-2 text-2xl font-semibold">学生列表</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-[#5f7285]">当前显示 {data.pagination.total} 名学生</span>
          <button type="button" onClick={() => setIsCreateOpen(true)} className="min-h-10 bg-[#184268] px-4 text-sm font-semibold text-white hover:bg-[#123653]">
            新增学生
          </button>
        </div>
      </div>

      <section
        className="mt-6 grid overflow-hidden rounded-lg border border-[#cfdae4] bg-white shadow-[0_4px_18px_rgba(24,66,104,0.05)] sm:grid-cols-2 lg:grid-cols-4"
        aria-label="学生统计与快捷筛选"
      >
        {summaryItems.map((item) => (
          <button
            key={item.label}
            type="button"
            aria-pressed={item.isActive}
            onClick={item.onClick}
            className={`min-h-32 rounded-none border-b border-[#d5e0e9] px-5 py-5 text-left transition last:border-b-0 hover:bg-[#f3f7fb] sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0 ${
              item.isActive ? "bg-[#edf4fa] shadow-[inset_0_3px_0_#184268]" : ""
            }`}
          >
            <span className="block text-sm font-semibold text-[#52677a]">
              {item.label}
            </span>
            <span className="mt-2 block text-3xl font-semibold text-[#172735]">
              {item.value}
            </span>
            <span className="mt-1 block text-xs text-[#6b7f92]">
              {item.description}
            </span>
          </button>
        ))}
      </section>

      {selectedIds.length > 0 ? (
        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-[#aac2d5] bg-[#edf4fa] px-4 py-3 shadow-[0_3px_12px_rgba(24,66,104,0.04)] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-[#184268]">已选择 {selectedIds.length} 名学生</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setSelectedIds([])} className="min-h-9 px-3 text-sm text-[#52677a]">取消选择</button>
            <button type="button" onClick={() => setIsBatchOpen(true)} className="min-h-9 bg-[#184268] px-4 text-sm font-semibold text-white">批量安排</button>
          </div>
        </div>
      ) : null}

      <section className="mt-6 rounded-lg border border-[#cfdae4] bg-white shadow-[0_4px_18px_rgba(24,66,104,0.05)]">
        <form
          className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-12 lg:items-end"
          onSubmit={handleSearch}
        >
          <div className="sm:col-span-2 lg:col-span-4">
            <label
              className="mb-2 block text-xs font-semibold text-[#52677a]"
              htmlFor="student-keyword"
            >
              搜索学生
            </label>
            <input
              id="student-keyword"
              type="search"
              maxLength={100}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="姓名、邮箱、手机号或学校"
              className="h-11 w-full border border-[#b9c9d7] px-3 text-sm outline-none focus:border-[#184268] focus:ring-2 focus:ring-[#184268]/15"
            />
          </div>

          <div className="lg:col-span-2">
            <label
              className="mb-2 block text-xs font-semibold text-[#52677a]"
              htmlFor="student-work-location"
            >
              工作地点
            </label>
            <select
              id="student-work-location"
              value={workLocation}
              onChange={(event) => {
                setIsLoading(true);
                setErrorMessage("");
                setWorkLocation(event.target.value as WorkLocation | "");
                setSelectedIds([]);
                setPage(1);
              }}
              className="h-11 w-full border border-[#b9c9d7] bg-white px-3 text-sm outline-none focus:border-[#184268] focus:ring-2 focus:ring-[#184268]/15"
            >
              <option value="">全部地点</option>
              {WORK_LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              className="mb-2 block text-xs font-semibold text-[#52677a]"
              htmlFor="student-status"
            >
              入职状态
            </label>
            <select
              id="student-status"
              value={status}
              onChange={(event) => {
                setIsLoading(true);
                setErrorMessage("");
                setStatus(event.target.value as OnboardingStatus | "");
                setSelectedIds([]);
                setPage(1);
              }}
              className="h-11 w-full border border-[#b9c9d7] bg-white px-3 text-sm outline-none focus:border-[#184268] focus:ring-2 focus:ring-[#184268]/15"
            >
              <option value="">全部状态</option>
              <option value="candidate">候选学生</option>
              <option value="pending_onboarding">待入职</option>
              <option value="onboarded">已入职</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              className="mb-2 block text-xs font-semibold text-[#52677a]"
              htmlFor="student-form-status"
            >
              表单状态
            </label>
            <select
              id="student-form-status"
              value={formStatus}
              onChange={(event) => {
                setIsLoading(true);
                setErrorMessage("");
                setFormStatus(
                  event.target.value as FormSubmissionStatus | "",
                );
                setSelectedIds([]);
                setPage(1);
              }}
              className="h-11 w-full border border-[#b9c9d7] bg-white px-3 text-sm outline-none focus:border-[#184268] focus:ring-2 focus:ring-[#184268]/15"
            >
              <option value="">全部表单状态</option>
              <option value="not_submitted">待填写</option>
              <option value="submitted">已提交</option>
            </select>
          </div>

          <div className="flex gap-3 sm:col-span-2 lg:col-span-2">
            <button
              type="submit"
              className="h-11 flex-1 bg-[#184268] px-4 text-sm font-semibold text-white transition hover:bg-[#123653] focus:outline-none focus:ring-2 focus:ring-[#184268]/25"
            >
              查询
            </button>

            <button
              type="button"
              className="h-11 flex-1 border border-[#b9c9d7] px-4 text-sm font-medium text-[#52677a] transition hover:border-[#184268] hover:text-[#184268] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!hasFilters && searchInput === ""}
              onClick={clearFilters}
            >
              清除
            </button>
          </div>
        </form>
      </section>

      <section className="mt-5 overflow-hidden rounded-lg border border-[#cfdae4] bg-white shadow-[0_4px_18px_rgba(24,66,104,0.05)]">
        {errorMessage ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[#9d3426]" role="alert">
              {errorMessage}
            </p>
            <button
              type="button"
              className="mt-4 min-h-10 border border-[#b9c9d7] px-4 text-sm font-medium text-[#425a6e]"
              onClick={() => {
                setIsLoading(true);
                setErrorMessage("");
                setRefreshKey((current) => current + 1);
              }}
            >
              重新加载
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] border-collapse text-left">
              <thead className="bg-[#f3f7fa] text-xs font-semibold text-[#52677a]">
                <tr>
                  <th className="w-12 border-b border-[#d5e0e9] px-4 py-3">
                    <input type="checkbox" aria-label="选择当前页可安排学生" checked={allPageItemsSelected} onChange={togglePageSelection} />
                  </th>
                  <th className="border-b border-[#d5e0e9] px-5 py-3">学生</th>
                  <th className="border-b border-[#d5e0e9] px-4 py-3">联系电话</th>
                  <th className="border-b border-[#d5e0e9] px-4 py-3">状态</th>
                  <th className="border-b border-[#d5e0e9] px-4 py-3">工作地点</th>
                  <th className="border-b border-[#d5e0e9] px-4 py-3">入职开始日期</th>
                  <th className="border-b border-[#d5e0e9] px-4 py-3">实习结束日期</th>
                  <th className="border-b border-[#d5e0e9] px-5 py-3">登记提交</th>
                  <th className="border-b border-[#d5e0e9] px-5 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-14 text-center text-[#5f7285]"
                    >
                      正在加载学生列表...
                    </td>
                  </tr>
                ) : data.items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-14 text-center text-[#5f7285]"
                    >
                      {hasFilters ? "没有符合条件的学生" : "暂无学生记录"}
                    </td>
                  </tr>
                ) : (
                  data.items.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b border-[#e2e9ef] last:border-b-0 hover:bg-[#f8fafc]"
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          aria-label={`选择 ${student.name}`}
                          disabled={student.onboardingStatus === "onboarded"}
                          checked={selectedIds.includes(student.id)}
                          onChange={() => setSelectedIds((ids) => ids.includes(student.id) ? ids.filter((id) => id !== student.id) : [...ids, student.id])}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/hr/students/${student.id}`}
                          className="inline-block font-semibold text-[#243648] transition-colors hover:text-[#006eb6] focus-visible:text-[#006eb6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#184268]"
                        >
                          {student.name}
                        </Link>
                        <p className="mt-1 max-w-64 truncate text-xs text-[#6b7f92]">
                          {student.email}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#425a6e]">
                        {student.phone ?? "未填写"}
                      </td>
                      <td className="px-4 py-4">
                        <OnboardingStatusBadge
                          status={student.onboardingStatus}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#425a6e]">
                        {student.workLocation ?? "未安排"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#425a6e]">
                        {formatDateOnly(student.onboardingStartAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#425a6e]">
                        {formatDateOnly(student.onboardingEndAt)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {student.submittedAt ? (
                          <div>
                            <p className="font-medium text-[#176555]">已提交</p>
                            <p className="mt-1 text-xs text-[#6b7f92]">
                              {formatDateTime(student.submittedAt)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[#8a5a35]">未提交</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setArrangingStudent(student)}
                            className="inline-flex min-h-9 items-center rounded-md border border-[#aabed0] px-3 text-sm font-medium text-[#244b70] hover:border-[#184268] hover:bg-[#edf4fa]"
                          >
                            安排
                          </button>
                          <Link href={`/hr/students/${student.id}`} className="inline-flex min-h-9 items-center rounded-md border border-[#aabed0] px-3 text-sm font-medium text-[#244b70] hover:border-[#184268] hover:bg-[#edf4fa]">
                            查看
                          </Link>
                        </div>
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
            <label htmlFor="page-size">每页</label>
            <select
              id="page-size"
              value={limit}
              onChange={(event) => {
                setIsLoading(true);
                setErrorMessage("");
                setLimit(Number(event.target.value));
                setPage(1);
              }}
              className="h-9 border border-[#b9c9d7] bg-white px-2 outline-none focus:border-[#184268]"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>条</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="min-h-10 border border-[#b9c9d7] px-4 text-sm font-medium text-[#425a6e] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={page <= 1 || isLoading}
              onClick={() => {
                setIsLoading(true);
                setPage((current) => Math.max(1, current - 1));
              }}
            >
              上一页
            </button>
            <span className="min-w-24 text-center text-sm text-[#5f7285]">
              第 {data.pagination.page} / {pageCount} 页
            </span>
            <button
              type="button"
              className="min-h-10 border border-[#b9c9d7] px-4 text-sm font-medium text-[#425a6e] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={page >= pageCount || isLoading}
              onClick={() => {
                setIsLoading(true);
                setPage((current) => current + 1);
              }}
            >
              下一页
            </button>
          </div>
        </div>
      </section>

      <HrCreateStudentModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={refreshList}
      />
      <HrBatchArrangementModal
        isOpen={isBatchOpen}
        studentIds={selectedIds}
        onClose={() => setIsBatchOpen(false)}
        onSaved={() => {
          setSelectedIds([]);
          refreshList();
        }}
      />
      <HrSingleArrangementModal
        key={arrangingStudent?.id ?? "closed"}
        student={arrangingStudent}
        isOpen={arrangingStudent !== null}
        onClose={() => setArrangingStudent(null)}
        onSaved={refreshList}
      />
    </main>
  );
}
