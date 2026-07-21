"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { HrModal } from "@/components/hr/hr-modal";
import { ApiError } from "@/lib/api/client";
import {
  getOperationLogs,
  getWorkLocationHistory,
  softDeleteHrStudent,
} from "@/lib/api/hr-students";
import { formatDateOnly, formatDateTime } from "@/lib/format-date";
import type {
  OperationAction,
  OperationLogResponse,
  WorkLocationHistoryItem,
} from "@/types/hr";

interface Props {
  studentId: string;
  studentName: string;
  refreshToken: string;
}

const actionLabels: Record<OperationAction, string> = {
  "student.created": "创建学生",
  "student.profile.updated": "修改登记信息",
  "student.arrangement.updated": "修改入职安排",
  "student.attachment.uploaded": "上传附件",
  "student.attachment.replaced": "替换附件",
  "student.attachment.deleted": "删除附件",
  "student.soft_deleted": "删除学生",
};

const sourceLabels: Record<WorkLocationHistoryItem["source"], string> = {
  backfill: "历史补录",
  single: "单个安排",
  batch: "批量安排",
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
  agreementSignedAt: "协议签署日期",
  notes: "补充说明",
  applicantSignature: "申请人签名",
  applicantSignedAt: "申请人签署日期",
  workLocation: "工作地点",
  onboardingStartAt: "入职开始日期",
  onboardingEndAt: "实习结束日期",
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
  if (attachment && typeof attachment === "object" && "originalName" in attachment) {
    return `附件：${valueText((attachment as { originalName?: unknown }).originalName)}`;
  }

  const replaced = changes.after;
  if (replaced && typeof replaced === "object" && "originalName" in replaced) {
    return `新附件：${valueText((replaced as { originalName?: unknown }).originalName)}`;
  }

  const details = ["workLocation", "onboardingStartAt", "onboardingEndAt"]
    .map((field) => {
      const change = changes[field];
      if (!change || typeof change !== "object") return null;
      const pair = change as { before?: unknown; after?: unknown };
      const displayValue = (value: unknown) =>
        field === "onboardingStartAt" || field === "onboardingEndAt"
          ? formatDateOnly(typeof value === "string" ? value : null)
          : valueText(value);
      return `${fieldLabels[field]}：${displayValue(pair.before)} → ${displayValue(pair.after)}`;
    })
    .filter((item): item is string => item !== null);

  if (details.length) return details.join("；");
  if (typeof changes.reason === "string" && changes.reason) {
    return `原因：${changes.reason}`;
  }
  return "操作已记录";
}

export function HrStudentActivity({ studentId, studentName, refreshToken }: Props) {
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
        setError(caught instanceof ApiError ? caught.message : "无法读取历史记录");
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [logPage, refreshToken, studentId]);

  async function confirmDelete() {
    setDeleteError("");
    setIsDeleting(true);
    try {
      await softDeleteHrStudent(studentId, deleteReason);
      router.replace("/hr/students");
      router.refresh();
    } catch (caught) {
      setDeleteError(caught instanceof ApiError ? caught.message : "删除学生失败");
      setIsDeleting(false);
    }
  }

  const pageCount = Math.max(1, logs.pagination.totalPages);

  return (
    <>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <section className="border border-[#d3ddda] bg-white">
          <header className="border-b border-[#d8e0dd] px-5 py-4 sm:px-6">
            <h2 className="font-semibold text-[#22322d]">工作地点历史</h2>
            <p className="mt-1 text-xs text-[#75817d]">记录学生曾在哪个地点工作，以及每次安排的生效时间。</p>
          </header>
          {isLoading ? (
            <p className="px-5 py-8 text-sm text-[#75817d]">正在加载地点历史...</p>
          ) : error ? (
            <p className="px-5 py-8 text-sm text-[#9d3426]" role="alert">{error}</p>
          ) : history.length ? (
            <ol className="divide-y divide-[#e3e9e7]">
              {history.map((item) => (
                <li key={item.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:px-6">
                  <div>
                    <p className="text-sm font-semibold text-[#2c3b37]">{item.workLocation}</p>
                    <p className="mt-1 text-xs text-[#75817d]">{formatDateTime(item.effectiveFrom)} 至 {item.effectiveTo ? formatDateTime(item.effectiveTo) : "当前"}</p>
                  </div>
                  <span className="self-start border border-[#cbd7d3] bg-[#f4f7f6] px-2 py-1 text-xs text-[#52615d]">{sourceLabels[item.source]}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-8 text-sm text-[#75817d]">暂无地点变更历史。</p>
          )}
        </section>

        <section className="border border-[#d3ddda] bg-white">
          <header className="border-b border-[#d8e0dd] px-5 py-4 sm:px-6">
            <h2 className="font-semibold text-[#22322d]">HR 操作日志</h2>
            <p className="mt-1 text-xs text-[#75817d]">日志只记录操作和必要字段，不复制身份证号等敏感内容。</p>
          </header>
          {isLoading ? (
            <p className="px-5 py-8 text-sm text-[#75817d]">正在加载操作日志...</p>
          ) : error ? (
            <p className="px-5 py-8 text-sm text-[#9d3426]" role="alert">{error}</p>
          ) : logs.items.length ? (
            <ol className="divide-y divide-[#e3e9e7]">
              {logs.items.map((log) => (
                <li key={log.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[#2c3b37]">{actionLabels[log.action]}</p>
                    <time className="text-xs text-[#75817d]">{formatDateTime(log.createdAt)}</time>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#66736f]">{describeChanges(log.changes)}</p>
                  <p className="mt-1 text-[11px] text-[#8a9491]">操作人 ID：{log.operatorHrId}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-8 text-sm text-[#75817d]">暂无操作日志。</p>
          )}

          {!isLoading && !error && logs.pagination.total > 0 ? (
            <div className="flex items-center justify-between border-t border-[#d8e0dd] px-5 py-3 text-xs text-[#66736f] sm:px-6">
              <button type="button" disabled={logPage <= 1} onClick={() => { setIsLoading(true); setError(""); setLogPage((page) => Math.max(1, page - 1)); }} className="min-h-9 border border-[#bdcac6] px-3 disabled:opacity-40">上一页</button>
              <span>第 {logs.pagination.page} / {pageCount} 页</span>
              <button type="button" disabled={logPage >= pageCount} onClick={() => { setIsLoading(true); setError(""); setLogPage((page) => page + 1); }} className="min-h-9 border border-[#bdcac6] px-3 disabled:opacity-40">下一页</button>
            </div>
          ) : null}
        </section>
      </div>

      <section className="mt-6 border border-[#dfc5c0] bg-white">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="font-semibold text-[#7f3025]">删除学生记录</h2>
            <p className="mt-1 text-xs leading-5 text-[#75635f]">学生将从正常列表中隐藏，现有附件和操作日志仍会保留。此功能暂不提供前端恢复入口。</p>
          </div>
          <button type="button" onClick={() => { setDeleteReason(""); setDeleteError(""); setIsDeleteOpen(true); }} className="min-h-10 shrink-0 border border-[#b95a4d] px-4 text-sm font-semibold text-[#9d3426] hover:bg-[#fff4f2]">删除学生</button>
        </div>
      </section>

      <HrModal isOpen={isDeleteOpen} onClose={() => !isDeleting && setIsDeleteOpen(false)} title={`确认删除 ${studentName}`} description="删除后，该学生无法继续登录，也不会出现在正常学生列表中。">
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <label className="block text-sm font-medium text-[#35453f]">删除原因（选填）
            <textarea maxLength={500} value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} placeholder="例如：学生未入职、offer 变动" className="mt-2 min-h-24 w-full border border-[#bdcac6] p-3 text-sm outline-none focus:border-[#147565]" />
          </label>
          <p className="text-xs text-[#9d3426]">请确认学生身份无误。删除动作会写入操作日志。</p>
          {deleteError ? <p className="text-sm text-[#9d3426]" role="alert">{deleteError}</p> : null}
          <div className="flex justify-end gap-3">
            <button type="button" disabled={isDeleting} onClick={() => setIsDeleteOpen(false)} className="min-h-11 border border-[#bdcac6] px-5 text-sm">取消</button>
            <button type="button" disabled={isDeleting} onClick={() => void confirmDelete()} className="min-h-11 bg-[#a23b2e] px-5 text-sm font-semibold text-white disabled:opacity-50">{isDeleting ? "正在删除..." : "确认删除学生"}</button>
          </div>
        </div>
      </HrModal>
    </>
  );
}
