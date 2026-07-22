"use client";

import { useRouter } from "next/navigation";
import { Pencil, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";

import { HrModal } from "@/components/hr/hr-modal";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { ApiError } from "@/lib/api/client";
import {
  cancelHrWorkLocationAssignment,
  getOperationLogs,
  getWorkLocationHistory,
  softDeleteHrStudent,
  updateHrWorkLocationAssignment,
} from "@/lib/api/hr-students";
import {
  chinaDateInputToIso,
  formatDateOnly,
  formatDateTime,
  getDayAfterChinaDateInput,
  getDayBeforeChinaDateInput,
  toChinaDateInput,
} from "@/lib/format-date";
import type {
  OperationAction,
  OperationLogResponse,
  WorkLocationHistoryItem,
} from "@/types/hr";
import {
  WORK_LOCATIONS,
  type WorkLocation,
} from "@/types/student";

interface Props {
  studentId: string;
  studentName: string;
  refreshToken: string;
  createdAt: string;
  updatedAt: string;
  hasSubmitted: boolean;
  onChanged: () => void;
}

const actionLabels: Record<OperationAction, string> = {
  "student.created": "创建学生",
  "student.profile.updated": "修改登记信息",
  "student.arrangement.updated": "修改入职安排",
  "student.work_location_assignment.updated": "修改工作地点记录",
  "student.work_location_assignment.cancelled": "撤销工作地点记录",
  "student.attachment.uploaded": "上传附件",
  "student.attachment.replaced": "替换附件",
  "student.attachment.deleted": "删除附件",
  "student.soft_deleted": "删除学生",
};

const sourceLabels: Record<WorkLocationHistoryItem["source"], string> = {
  create: "创建时安排",
  backfill: "历史补录",
  single: "单个安排",
  batch: "批量安排",
  change: "地点变更",
};

const fieldLabels: Record<string, string> = {
  name: "姓名",
  email: "邮箱",
  phone: "联系电话",
  basicInfo: "个人情况",
  educationExperiences: "教育经历",
  familyMembers: "家庭成员",
  internshipExperiences: "实习经历",
  emergencyContactName: "紧急联系人",
  emergencyContactPhone: "紧急联系电话",
  emergencyContactRelation: "紧急联系人关系",
  hasIdCopyAndAgreement: "证件和协议状态",
  notes: "补充说明",
  applicantSignature: "申请人签名",
  applicantSignedAt: "申请人签署日期",
  workLocation: "工作地点",
  onboardingStartAt: "实习开始日期",
  onboardingEndAt: "实习结束日期",
  effectiveFrom: "地点开始日期",
};

const emptyLogs: OperationLogResponse = {
  items: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "未设置";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
    return value;
  }
  return String(value);
}

function describeChanges(changes: Record<string, unknown> | null): string {
  if (!changes) return "无补充信息";

  if (Array.isArray(changes.fields)) {
    return `修改字段：${changes.fields
      .map((field) => fieldLabels[String(field)] ?? String(field))
      .join("、")}`;
  }

  const attachment = changes.attachment;
  if (
    attachment &&
    typeof attachment === "object" &&
    "originalName" in attachment
  ) {
    return `附件：${valueText((attachment as { originalName?: unknown }).originalName)}`;
  }

  const replaced = changes.after;
  if (replaced && typeof replaced === "object" && "originalName" in replaced) {
    return `新附件：${valueText((replaced as { originalName?: unknown }).originalName)}`;
  }

  const details = [
    "workLocation",
    "onboardingStartAt",
    "onboardingEndAt",
    "effectiveFrom",
  ]
    .map((field) => {
      const change = changes[field];
      if (!change || typeof change !== "object") return null;
      const pair = change as { before?: unknown; after?: unknown };
      const displayValue = (value: unknown) =>
        field === "onboardingStartAt" ||
        field === "onboardingEndAt" ||
        field === "effectiveFrom"
          ? formatDateOnly(typeof value === "string" ? value : null)
          : valueText(value);
      return `${fieldLabels[field]}：${displayValue(pair.before)} → ${displayValue(pair.after)}`;
    })
    .filter((item): item is string => item !== null);

  if (
    changes.effectiveFrom &&
    typeof changes.effectiveFrom !== "object"
  ) {
    details.push(
      `地点生效日期：${formatDateOnly(
        typeof changes.effectiveFrom === "string"
          ? changes.effectiveFrom
          : null,
      )}`,
    );
  }

  if (details.length) return details.join("；");
  if (typeof changes.reason === "string" && changes.reason) {
    return `原因：${changes.reason}`;
  }
  return "操作已记录";
}

export function HrStudentActivity({
  studentId,
  studentName,
  refreshToken,
  createdAt,
  updatedAt,
  hasSubmitted,
  onChanged,
}: Props) {
  const router = useRouter();
  const [history, setHistory] = useState<WorkLocationHistoryItem[]>([]);
  const [logs, setLogs] = useState<OperationLogResponse>(emptyLogs);
  const [logPage, setLogPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");
  const [editingAssignment, setEditingAssignment] =
    useState<WorkLocationHistoryItem | null>(null);
  const [editLocation, setEditLocation] = useState<WorkLocation | "">("");
  const [editEffectiveFrom, setEditEffectiveFrom] = useState("");
  const [editMinimum, setEditMinimum] = useState("");
  const [editMaximum, setEditMaximum] = useState("");
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [cancellingAssignment, setCancellingAssignment] =
    useState<WorkLocationHistoryItem | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!successMessage) return;
    const timeoutId = window.setTimeout(() => setSuccessMessage(""), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  useEffect(() => {
    let isActive = true;

    void Promise.all([
      getWorkLocationHistory(studentId),
      getOperationLogs(studentId, logPage),
    ])
      .then(([historyResponse, logResponse]) => {
        if (!isActive) return;
        setError("");
        setHistory(historyResponse.items);
        setLogs(logResponse);
      })
      .catch((caught: unknown) => {
        if (!isActive) return;
        setError(
          caught instanceof ApiError ? caught.message : "无法读取历史记录",
        );
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [activityRefreshKey, logPage, refreshToken, studentId]);

  function refreshActivity(message: string) {
    setSuccessMessage(message);
    setActivityRefreshKey((current) => current + 1);
    onChanged();
  }

  function openEditAssignment(
    assignment: WorkLocationHistoryItem,
    descendingIndex: number,
  ) {
    const previousAssignment = history[descendingIndex + 1];
    const nextAssignment = history[descendingIndex - 1];
    const knownLocation = WORK_LOCATIONS.includes(
      assignment.workLocation as WorkLocation,
    )
      ? (assignment.workLocation as WorkLocation)
      : "";

    setEditingAssignment(assignment);
    setEditLocation(knownLocation);
    setEditEffectiveFrom(toChinaDateInput(assignment.effectiveFrom));
    setEditMinimum(
      getDayAfterChinaDateInput(previousAssignment?.effectiveFrom ?? null),
    );
    setEditMaximum(
      getDayBeforeChinaDateInput(nextAssignment?.effectiveFrom ?? null),
    );
    setEditError("");
  }

  async function confirmEditAssignment() {
    if (!editingAssignment || !editLocation || !editEffectiveFrom) {
      setEditError("请选择工作地点和开始日期");
      return;
    }

    setEditError("");
    setIsSavingEdit(true);
    try {
      await updateHrWorkLocationAssignment(
        studentId,
        editingAssignment.id,
        {
          workLocation: editLocation,
          effectiveFrom: chinaDateInputToIso(editEffectiveFrom),
        },
      );
      setEditingAssignment(null);
      refreshActivity("工作地点记录修改成功");
    } catch (caught) {
      setEditError(
        caught instanceof ApiError ? caught.message : "修改工作地点记录失败",
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function confirmCancelAssignment() {
    if (!cancellingAssignment) return;

    setCancelError("");
    setIsCancelling(true);
    try {
      await cancelHrWorkLocationAssignment(
        studentId,
        cancellingAssignment.id,
      );
      setCancellingAssignment(null);
      refreshActivity("工作地点记录已撤销");
    } catch (caught) {
      setCancelError(
        caught instanceof ApiError ? caught.message : "撤销工作地点记录失败",
      );
    } finally {
      setIsCancelling(false);
    }
  }

  async function confirmDelete() {
    setDeleteError("");
    setIsDeleting(true);
    try {
      await softDeleteHrStudent(studentId, deleteReason);
      router.replace("/hr/students");
      router.refresh();
    } catch (caught) {
      setDeleteError(
        caught instanceof ApiError ? caught.message : "删除学生失败",
      );
      setIsDeleting(false);
    }
  }

  const pageCount = Math.max(1, logs.pagination.totalPages);

  return (
    <>
      {successMessage ? (
        <div
          className="fixed right-5 top-5 z-[120] rounded-md border border-[#9bcdbf] bg-[#e9f7f2] px-4 py-3 text-sm font-semibold text-[#176b58] shadow-lg"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-lg border border-[#cfdae4] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.05)]">
            <header className="border-b border-[#d5e0e9] px-5 py-4 sm:px-6">
              <h2 className="font-semibold text-[#223548]">工作地点历史</h2>
              <p className="mt-1 text-xs text-[#6b7f92]">
                记录学生曾在哪个地点工作，以及每次安排的生效时间。
              </p>
            </header>
            {isLoading ? (
              <p className="px-5 py-8 text-sm text-[#6b7f92]">
                正在加载地点历史...
              </p>
            ) : error ? (
              <p className="px-5 py-8 text-sm text-[#9d3426]" role="alert">
                {error}
              </p>
            ) : history.length ? (
              <ol className="divide-y divide-[#e1e8ef]">
                {history.map((item, index) => {
                  const isInitialAssignment = index === history.length - 1;

                  return (
                    <li
                      key={item.id}
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:px-6"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#2b3e50]">
                          {item.workLocation}
                        </p>
                        <p className="mt-1 text-xs text-[#6b7f92]">
                          {formatDateOnly(item.effectiveFrom)} 至{" "}
                          {item.effectiveTo
                            ? `${formatDateOnly(item.effectiveTo)} 前`
                            : "当前"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-start justify-start gap-2 sm:justify-end">
                        <span className="rounded border border-[#c7d6e2] bg-[#f3f7fa] px-2 py-1 text-xs text-[#52677a]">
                          {isInitialAssignment
                            ? "初始安排"
                            : sourceLabels[item.source]}
                        </span>
                        {!isInitialAssignment ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditAssignment(item, index)}
                              className="inline-flex min-h-7 cursor-pointer items-center gap-1 rounded border border-[#a9bfd2] px-2 text-xs font-medium text-[#244b70] transition hover:border-[#184268] hover:bg-[#edf4fa]"
                            >
                              <Pencil
                                aria-hidden="true"
                                className="h-3.5 w-3.5"
                              />
                              修改
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCancelError("");
                                setCancellingAssignment(item);
                              }}
                              className="inline-flex min-h-7 cursor-pointer items-center gap-1 rounded border border-[#d8aaa2] px-2 text-xs font-medium text-[#94382b] transition hover:border-[#b95a4d] hover:bg-[#fff4f2]"
                            >
                              <Undo2
                                aria-hidden="true"
                                className="h-3.5 w-3.5"
                              />
                              撤销
                            </button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="px-5 py-8 text-sm text-[#6b7f92]">
                暂无地点变更历史。
              </p>
            )}
          </section>

          <section className="overflow-hidden rounded-lg border border-[#cfdae4] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.05)]">
            <header className="border-b border-[#d5e0e9] px-5 py-4 sm:px-6">
              <h2 className="font-semibold text-[#223548]">记录信息</h2>
            </header>
            <dl className="grid gap-4 px-5 py-5 sm:px-6">
              {[
                ["系统创建时间", formatDateTime(createdAt)],
                ["最后更新时间", formatDateTime(updatedAt)],
                ["学生提交状态", hasSubmitted ? "已提交，仅 HR 可修改" : "未提交"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="border-b border-[#e1e8ef] pb-3 last:border-b-0 last:pb-0"
                >
                  <dt className="text-xs font-medium text-[#6b7f92]">
                    {label}
                  </dt>
                  <dd className="mt-1.5 text-sm font-medium text-[#2b3e50]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <section className="overflow-hidden rounded-lg border border-[#cfdae4] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.05)]">
          <header className="border-b border-[#d5e0e9] px-5 py-4 sm:px-6">
            <h2 className="font-semibold text-[#223548]">HR 操作日志</h2>
            <p className="mt-1 text-xs text-[#6b7f92]">
              日志只记录操作和必要字段，不复制身份证号等敏感内容。
            </p>
          </header>
          {isLoading ? (
            <p className="px-5 py-8 text-sm text-[#6b7f92]">
              正在加载操作日志...
            </p>
          ) : error ? (
            <p className="px-5 py-8 text-sm text-[#9d3426]" role="alert">
              {error}
            </p>
          ) : logs.items.length ? (
            <ol className="divide-y divide-[#e1e8ef]">
              {logs.items.map((log) => (
                <li key={log.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[#2b3e50]">
                      {actionLabels[log.action]}
                    </p>
                    <time className="text-xs text-[#6b7f92]">
                      {formatDateTime(log.createdAt)}
                    </time>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#5f7285]">
                    {describeChanges(log.changes)}
                  </p>
                  <p className="mt-1 text-[11px] text-[#7f90a0]">
                    操作人 ID：{log.operatorHrId}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-8 text-sm text-[#6b7f92]">暂无操作日志。</p>
          )}

          {!isLoading && !error && logs.pagination.total > 0 ? (
            <div className="flex items-center justify-between border-t border-[#d5e0e9] px-5 py-3 text-xs text-[#5f7285] sm:px-6">
              <button
                type="button"
                disabled={logPage <= 1}
                onClick={() => {
                  setIsLoading(true);
                  setError("");
                  setLogPage((page) => Math.max(1, page - 1));
                }}
                className="min-h-9 border border-[#b9c9d7] px-3 disabled:opacity-40"
              >
                上一页
              </button>
              <span>
                第 {logs.pagination.page} / {pageCount} 页
              </span>
              <button
                type="button"
                disabled={logPage >= pageCount}
                onClick={() => {
                  setIsLoading(true);
                  setError("");
                  setLogPage((page) => page + 1);
                }}
                className="min-h-9 border border-[#b9c9d7] px-3 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          ) : null}
        </section>
      </div>

      <HrModal
        isOpen={editingAssignment !== null}
        onClose={() => !isSavingEdit && setEditingAssignment(null)}
        title="修改工作地点记录"
        description="只修改这一段；系统会自动重算相邻地点的结束日期。"
      >
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <label className="block text-sm font-medium text-[#31485c]">
            工作地点
            <select
              value={editLocation}
              disabled={isSavingEdit}
              onChange={(event) =>
                setEditLocation(event.target.value as WorkLocation)
              }
              className="mt-2 min-h-11 w-full rounded-md border border-[#b9c9d7] bg-white px-3 outline-none focus:border-[#184268]"
            >
              <option value="">请选择</option>
              {WORK_LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </label>

          <div>
            <label
              htmlFor="edit-work-location-effective-from"
              className="block text-sm font-medium text-[#31485c]"
            >
              本段开始日期
            </label>
            <DatePickerInput
              id="edit-work-location-effective-from"
              value={editEffectiveFrom}
              min={editMinimum || undefined}
              max={editMaximum || undefined}
              disabled={isSavingEdit}
              onChange={(event) => setEditEffectiveFrom(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-md border border-[#b9c9d7] bg-white px-3 outline-none focus:border-[#184268]"
            />
            <p className="mt-2 text-xs text-[#6b7f92]">
              开始日期必须晚于上一段；存在下一段时，也必须早于下一段。
            </p>
          </div>

          {editError ? (
            <p className="text-sm text-[#9d3426]" role="alert">
              {editError}
            </p>
          ) : null}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={isSavingEdit}
              onClick={() => setEditingAssignment(null)}
              className="min-h-11 cursor-pointer rounded-md border border-[#b9c9d7] px-5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={isSavingEdit}
              onClick={() => void confirmEditAssignment()}
              className="min-h-11 cursor-pointer rounded-md bg-[#184268] px-5 text-sm font-semibold text-white transition hover:bg-[#123653] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingEdit ? "正在保存..." : "保存修改"}
            </button>
          </div>
        </div>
      </HrModal>

      <HrModal
        isOpen={cancellingAssignment !== null}
        onClose={() => !isCancelling && setCancellingAssignment(null)}
        title="撤销工作地点记录"
        description="撤销后，系统会自动连接前后时间段；此操作仍会保留在 HR 操作日志中。"
      >
        <div className="space-y-4 px-5 py-5 sm:px-6">
          {cancellingAssignment ? (
            <div className="rounded-md border border-[#d5e0e9] bg-[#f6f9fb] px-4 py-3 text-sm text-[#31485c]">
              <p className="font-semibold">
                {cancellingAssignment.workLocation}
              </p>
              <p className="mt-1 text-xs text-[#6b7f92]">
                从 {formatDateOnly(cancellingAssignment.effectiveFrom)} 开始
              </p>
            </div>
          ) : null}
          <p className="text-sm leading-6 text-[#6f443d]">
            请确认这是一条误操作记录。撤销后无法直接恢复，但可重新新增地点变更。
          </p>
          {cancelError ? (
            <p className="text-sm text-[#9d3426]" role="alert">
              {cancelError}
            </p>
          ) : null}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={isCancelling}
              onClick={() => setCancellingAssignment(null)}
              className="min-h-11 cursor-pointer rounded-md border border-[#b9c9d7] px-5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={isCancelling}
              onClick={() => void confirmCancelAssignment()}
              className="min-h-11 cursor-pointer rounded-md bg-[#a23b2e] px-5 text-sm font-semibold text-white transition hover:bg-[#853126] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCancelling ? "正在撤销..." : "确认撤销"}
            </button>
          </div>
        </div>
      </HrModal>

      <section className="mt-6 overflow-hidden rounded-lg border border-[#dfc5c0] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.04)]">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="font-semibold text-[#7f3025]">删除学生记录</h2>
            <p className="mt-1 text-xs leading-5 text-[#75635f]">
              学生将从正常列表中隐藏，现有附件和操作日志仍会保留。此功能暂不提供前端恢复入口。
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeleteReason("");
              setDeleteError("");
              setIsDeleteOpen(true);
            }}
            className="min-h-10 shrink-0 border border-[#b95a4d] px-4 text-sm font-semibold text-[#9d3426] hover:bg-[#fff4f2]"
          >
            删除学生
          </button>
        </div>
      </section>

      <HrModal
        isOpen={isDeleteOpen}
        onClose={() => !isDeleting && setIsDeleteOpen(false)}
        title={`确认删除 ${studentName}`}
        description="删除后，该学生无法继续登录，也不会出现在正常学生列表中。"
      >
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <label className="block text-sm font-medium text-[#31485c]">
            删除原因（选填）
            <textarea
              maxLength={500}
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              placeholder="例如：学生未入职、offer 变动"
              className="mt-2 min-h-24 w-full border border-[#b9c9d7] p-3 text-sm outline-none focus:border-[#184268]"
            />
          </label>
          <p className="text-xs text-[#9d3426]">
            请确认学生身份无误。删除动作会写入操作日志。
          </p>
          {deleteError ? (
            <p className="text-sm text-[#9d3426]" role="alert">
              {deleteError}
            </p>
          ) : null}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setIsDeleteOpen(false)}
              className="min-h-11 border border-[#b9c9d7] px-5 text-sm"
            >
              取消
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => void confirmDelete()}
              className="min-h-11 bg-[#a23b2e] px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isDeleting ? "正在删除..." : "确认删除学生"}
            </button>
          </div>
        </div>
      </HrModal>
    </>
  );
}
