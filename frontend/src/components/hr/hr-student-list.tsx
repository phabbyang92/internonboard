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
  HrStudentListItem,
  HrStudentListResponse,
} from "@/types/hr";
import type { OnboardingStatus } from "@/types/student";

const emptyResponse: HrStudentListResponse = {
  items: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

export function HrStudentList() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<OnboardingStatus | "">("");
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

    void listHrStudents({ page, limit, keyword, status })
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
  }, [keyword, limit, page, refreshKey, router, status]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    setPage(1);
    setKeyword(searchInput.trim());
    setRefreshKey((current) => current + 1);
  }

  function clearFilters() {
    setIsLoading(true);
    setErrorMessage("");
    setSearchInput("");
    setKeyword("");
    setStatus("");
    setPage(1);
    setRefreshKey((current) => current + 1);
  }

  const pageCount = Math.max(1, data.pagination.totalPages);
  const hasFilters = keyword !== "" || status !== "";
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

  return (
    <main className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
      <div className="flex flex-col gap-4 border-b border-[#cdd8d4] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#147565]">学生管理</p>
          <h1 className="mt-2 text-2xl font-semibold">学生列表</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-[#66736f]">共 {data.pagination.total} 名学生</span>
          <button type="button" onClick={() => setIsCreateOpen(true)} className="min-h-10 bg-[#147565] px-4 text-sm font-semibold text-white hover:bg-[#0f6255]">
            新增学生
          </button>
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div className="mt-5 flex flex-col gap-3 border border-[#a9c9c1] bg-[#edf7f4] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-[#175e51]">已选择 {selectedIds.length} 名学生</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setSelectedIds([])} className="min-h-9 px-3 text-sm text-[#52615d]">取消选择</button>
            <button type="button" onClick={() => setIsBatchOpen(true)} className="min-h-9 bg-[#147565] px-4 text-sm font-semibold text-white">批量安排</button>
          </div>
        </div>
      ) : null}

      <section className="mt-6 border-y border-[#d3ddda] bg-white">
        <form
          className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(240px,1fr)_190px_130px_auto] md:items-end sm:px-5"
          onSubmit={handleSearch}
        >
          <div>
            <label
              className="mb-2 block text-xs font-semibold text-[#52615d]"
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
              placeholder="姓名、邮箱或手机号"
              className="h-11 w-full border border-[#bdcac6] px-3 text-sm outline-none focus:border-[#147565] focus:ring-2 focus:ring-[#147565]/15"
            />
          </div>

          <div>
            <label
              className="mb-2 block text-xs font-semibold text-[#52615d]"
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
                setPage(1);
              }}
              className="h-11 w-full border border-[#bdcac6] bg-white px-3 text-sm outline-none focus:border-[#147565] focus:ring-2 focus:ring-[#147565]/15"
            >
              <option value="">全部状态</option>
              <option value="candidate">候选学生</option>
              <option value="pending_onboarding">待入职</option>
              <option value="onboarded">已入职</option>
            </select>
          </div>

          <button
            type="submit"
            className="h-11 bg-[#147565] px-5 text-sm font-semibold text-white transition hover:bg-[#0f6255] focus:outline-none focus:ring-2 focus:ring-[#147565]/25"
          >
            查询
          </button>

          <button
            type="button"
            className="h-11 border border-[#bdcac6] px-4 text-sm font-medium text-[#52615d] transition hover:border-[#147565] hover:text-[#147565] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!hasFilters && searchInput === ""}
            onClick={clearFilters}
          >
            清除
          </button>
        </form>
      </section>

      <section className="mt-5 overflow-hidden border border-[#d3ddda] bg-white">
        {errorMessage ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[#9d3426]" role="alert">
              {errorMessage}
            </p>
            <button
              type="button"
              className="mt-4 min-h-10 border border-[#bdcac6] px-4 text-sm font-medium text-[#44514d]"
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
              <thead className="bg-[#f4f7f6] text-xs font-semibold text-[#52615d]">
                <tr>
                  <th className="w-12 border-b border-[#d8e0dd] px-4 py-3">
                    <input type="checkbox" aria-label="选择当前页可安排学生" checked={allPageItemsSelected} onChange={togglePageSelection} />
                  </th>
                  <th className="border-b border-[#d8e0dd] px-5 py-3">学生</th>
                  <th className="border-b border-[#d8e0dd] px-4 py-3">联系电话</th>
                  <th className="border-b border-[#d8e0dd] px-4 py-3">状态</th>
                  <th className="border-b border-[#d8e0dd] px-4 py-3">工作地点</th>
                  <th className="border-b border-[#d8e0dd] px-4 py-3">入职开始时间</th>
                  <th className="border-b border-[#d8e0dd] px-4 py-3">实习结束日期</th>
                  <th className="border-b border-[#d8e0dd] px-5 py-3">登记提交</th>
                  <th className="border-b border-[#d8e0dd] px-5 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-14 text-center text-[#66736f]"
                    >
                      正在加载学生列表...
                    </td>
                  </tr>
                ) : data.items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-14 text-center text-[#66736f]"
                    >
                      {hasFilters ? "没有符合条件的学生" : "暂无学生记录"}
                    </td>
                  </tr>
                ) : (
                  data.items.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b border-[#e4eae8] last:border-b-0 hover:bg-[#f8faf9]"
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
                        <p className="font-semibold text-[#25332f]">
                          {student.name}
                        </p>
                        <p className="mt-1 max-w-64 truncate text-xs text-[#75817d]">
                          {student.email}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#44514d]">
                        {student.phone ?? "未填写"}
                      </td>
                      <td className="px-4 py-4">
                        <OnboardingStatusBadge
                          status={student.onboardingStatus}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#44514d]">
                        {student.workLocation ?? "未安排"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#44514d]">
                        {formatDateTime(student.onboardingStartAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#44514d]">
                        {formatDateOnly(student.onboardingEndAt)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {student.submittedAt ? (
                          <div>
                            <p className="font-medium text-[#176555]">已提交</p>
                            <p className="mt-1 text-xs text-[#75817d]">
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
                            className="inline-flex min-h-9 items-center border border-[#aebdb8] px-3 text-sm font-medium text-[#285c51] hover:border-[#147565]"
                          >
                            安排
                          </button>
                          <Link href={`/hr/students/${student.id}`} className="inline-flex min-h-9 items-center border border-[#aebdb8] px-3 text-sm font-medium text-[#285c51] hover:border-[#147565]">
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

        <div className="flex flex-col gap-4 border-t border-[#d8e0dd] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-[#66736f]">
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
              className="h-9 border border-[#bdcac6] bg-white px-2 outline-none focus:border-[#147565]"
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
              className="min-h-10 border border-[#bdcac6] px-4 text-sm font-medium text-[#44514d] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={page <= 1 || isLoading}
              onClick={() => {
                setIsLoading(true);
                setPage((current) => Math.max(1, current - 1));
              }}
            >
              上一页
            </button>
            <span className="min-w-24 text-center text-sm text-[#66736f]">
              第 {data.pagination.page} / {pageCount} 页
            </span>
            <button
              type="button"
              className="min-h-10 border border-[#bdcac6] px-4 text-sm font-medium text-[#44514d] disabled:cursor-not-allowed disabled:opacity-45"
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
