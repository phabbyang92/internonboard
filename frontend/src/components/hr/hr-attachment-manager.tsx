"use client";

import { useState, type FormEvent } from "react";

import { HrModal } from "@/components/hr/hr-modal";
import { ApiError } from "@/lib/api/client";
import {
  deleteHrAttachment,
  downloadHrAttachment,
  replaceHrAttachment,
  uploadHrAttachment,
} from "@/lib/api/hr-students";
import type { HrStudentDetail } from "@/types/hr";
import {
  ATTACHMENT_TYPES,
  type AttachmentMetadata,
  type AttachmentType,
} from "@/types/student";

interface Props {
  student: HrStudentDetail;
  onChanged: () => void;
}

const attachmentLabels: Record<AttachmentType, string> = {
  resume: "简历",
  id_card_front: "身份证正面（或外籍护照首页）",
  id_card_back: "身份证反面（或外籍护照签证页）",
};

const accepts: Record<AttachmentType, string> = {
  resume: ".pdf,.doc,.docx",
  id_card_front: ".pdf,.jpg,.jpeg,.png",
  id_card_back: ".pdf,.jpg,.jpeg,.png",
};

interface PendingReplacement {
  attachment: AttachmentMetadata;
  file: File;
}

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function HrAttachmentManager({ student, onChanged }: Props) {
  const [uploadType, setUploadType] = useState<AttachmentType>("resume");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [pendingReplacement, setPendingReplacement] =
    useState<PendingReplacement | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<AttachmentMetadata | null>(null);
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function beginAction(action: string) {
    setBusyAction(action);
    setMessage("");
    setError("");
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!uploadFile) {
      setError("请先选择需要上传的文件");
      return;
    }

    beginAction("upload");
    try {
      await uploadHrAttachment(student.id, uploadType, uploadFile);
      setUploadFile(null);
      form.reset();
      setUploadType("resume");
      setMessage("附件上传成功");
      onChanged();
    } catch (caught) {
      setError(errorText(caught, "附件上传失败"));
    } finally {
      setBusyAction("");
    }
  }

  async function handleDownload(attachment: AttachmentMetadata) {
    beginAction(`download:${attachment.storageKey}`);
    try {
      const blob = await downloadHrAttachment(
        student.id,
        attachment.storageKey,
      );
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.originalName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      setMessage(`已下载 ${attachment.originalName}`);
    } catch (caught) {
      setError(errorText(caught, "附件下载失败"));
    } finally {
      setBusyAction("");
    }
  }

  async function confirmReplacement() {
    if (!pendingReplacement) return;
    const { attachment, file } = pendingReplacement;
    beginAction("replace");
    try {
      await replaceHrAttachment(
        student.id,
        attachment.storageKey,
        attachment.type,
        file,
      );
      setPendingReplacement(null);
      setMessage("附件替换成功，旧文件已从存储中删除");
      onChanged();
    } catch (caught) {
      setError(errorText(caught, "附件替换失败"));
    } finally {
      setBusyAction("");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    beginAction("delete");
    try {
      await deleteHrAttachment(student.id, pendingDelete.storageKey);
      setPendingDelete(null);
      setMessage("附件已删除");
      onChanged();
    } catch (caught) {
      setError(errorText(caught, "附件删除失败"));
    } finally {
      setBusyAction("");
    }
  }

  const isBusy = busyAction !== "";

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-[#cfdae4] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.05)]">
        <header className="border-b border-[#d5e0e9] px-5 py-4">
          <h2 className="font-semibold">附件资料</h2>
          <p className="mt-1 text-xs text-[#6b7f92]">
            单个文件不超过 10 MB；HR 可管理已提交和已入职学生的附件。
          </p>
        </header>

        {student.attachments.length ? (
          <ul className="divide-y divide-[#e1e8ef]">
            {student.attachments.map((attachment, index) => (
              <li key={attachment.storageKey} className="px-5 py-4">
                <p className="break-all text-sm font-medium text-[#2b3e50]">
                  {attachment.originalName}
                </p>
                <p className="mt-1 text-xs text-[#6b7f92]">
                  {attachmentLabels[attachment.type]}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleDownload(attachment)}
                    className="min-h-9 border border-[#aabed0] px-3 text-xs font-medium text-[#244b70] disabled:opacity-50"
                  >
                    {busyAction === `download:${attachment.storageKey}`
                      ? "下载中..."
                      : "下载"}
                  </button>
                  <label
                    htmlFor={`replace-attachment-${index}`}
                    className={`inline-flex min-h-9 items-center border border-[#aabed0] px-3 text-xs font-medium text-[#244b70] ${isBusy ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
                  >
                    替换
                  </label>
                  <input
                    id={`replace-attachment-${index}`}
                    aria-label={`替换 ${attachment.originalName}`}
                    type="file"
                    accept={accepts[attachment.type]}
                    className="sr-only"
                    disabled={isBusy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) setPendingReplacement({ attachment, file });
                      event.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setPendingDelete(attachment)}
                    className="min-h-9 border border-[#d9b8b2] px-3 text-xs font-medium text-[#9d3426] disabled:opacity-50"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-sm text-[#6b7f92]">暂无附件。</p>
        )}

        <form className="border-t border-[#d5e0e9] bg-[#f7f9fb] px-5 py-4" onSubmit={handleUpload}>
          <p className="text-sm font-semibold text-[#31485c]">上传新附件</p>
          <div className="mt-3 grid gap-3">
            <label className="text-xs font-medium text-[#52677a]">
              附件类型
              <select
                value={uploadType}
                onChange={(event) => {
                  setUploadType(event.target.value as AttachmentType);
                  setUploadFile(null);
                }}
                className="mt-1.5 h-10 w-full border border-[#b9c9d7] bg-white px-3 text-sm"
              >
                {ATTACHMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {attachmentLabels[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-[#52677a]">
              选择文件
              <input
                key={uploadType}
                required
                type="file"
                accept={accepts[uploadType]}
                onChange={(event) =>
                  setUploadFile(event.target.files?.[0] ?? null)
                }
                className="mt-1.5 block w-full text-xs file:mr-3 file:min-h-9 file:border file:border-[#b9c9d7] file:bg-white file:px-3 file:text-xs"
              />
            </label>
            <button
              disabled={isBusy || !uploadFile}
              className="min-h-10 bg-[#184268] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === "upload" ? "正在上传..." : "上传附件"}
            </button>
          </div>
        </form>

        {message ? (
          <p className="border-t border-[#b8d6cf] bg-[#eef8f4] px-5 py-3 text-xs text-[#175e51]" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="border-t border-[#e4c8c2] bg-[#fff5f3] px-5 py-3 text-xs text-[#9d3426]" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <HrModal
        isOpen={pendingReplacement !== null}
        onClose={() => !isBusy && setPendingReplacement(null)}
        title="确认替换附件"
        description="替换成功后，旧文件会从本地存储或 OSS 中删除。"
      >
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="border border-[#d5e0e9] bg-[#f7f9fb] p-4 text-sm">
            <p><span className="text-[#6b7f92]">原文件：</span>{pendingReplacement?.attachment.originalName}</p>
            <p className="mt-2"><span className="text-[#6b7f92]">新文件：</span>{pendingReplacement?.file.name}</p>
          </div>
          {error ? <p className="text-sm text-[#9d3426]" role="alert">{error}</p> : null}
          <div className="flex justify-end gap-3">
            <button type="button" disabled={isBusy} onClick={() => setPendingReplacement(null)} className="min-h-11 border border-[#b9c9d7] px-5 text-sm">取消</button>
            <button type="button" disabled={isBusy} onClick={() => void confirmReplacement()} className="min-h-11 bg-[#184268] px-5 text-sm font-semibold text-white disabled:opacity-50">{busyAction === "replace" ? "正在替换..." : "确认替换"}</button>
          </div>
        </div>
      </HrModal>

      <HrModal
        isOpen={pendingDelete !== null}
        onClose={() => !isBusy && setPendingDelete(null)}
        title="确认删除附件"
        description="该操作会同时删除附件记录和对应的本地或 OSS 文件。"
      >
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <p className="break-all text-sm text-[#31485c]">确定删除“{pendingDelete?.originalName}”吗？</p>
          {error ? <p className="text-sm text-[#9d3426]" role="alert">{error}</p> : null}
          <div className="flex justify-end gap-3">
            <button type="button" disabled={isBusy} onClick={() => setPendingDelete(null)} className="min-h-11 border border-[#b9c9d7] px-5 text-sm">取消</button>
            <button type="button" disabled={isBusy} onClick={() => void confirmDelete()} className="min-h-11 bg-[#a23b2e] px-5 text-sm font-semibold text-white disabled:opacity-50">{busyAction === "delete" ? "正在删除..." : "确认删除"}</button>
          </div>
        </div>
      </HrModal>
    </>
  );
}
