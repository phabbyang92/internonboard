"use client";

import {
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  deleteStudentAttachment,
  uploadStudentAttachment,
} from "@/lib/api/student-form";
import type { AttachmentMetadata, AttachmentType } from "@/types/student";

interface AttachmentsSectionProps {
  attachments: AttachmentMetadata[];
  onAttachmentsChange: Dispatch<SetStateAction<AttachmentMetadata[]>>;
  onBusyChange: (isBusy: boolean) => void;
}

interface AttachmentRule {
  type: AttachmentType;
  label: string;
  required: boolean;
  accept: string;
  formats: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const attachmentRules: AttachmentRule[] = [
  {
    type: "resume",
    label: "个人简历",
    required: true,
    accept: ".pdf,.doc,.docx",
    formats: "PDF、DOC、DOCX",
  },
  {
    type: "id_card_front",
    label: "身份证正面（或外籍护照首页）",
    required: true,
    accept: ".pdf,.jpg,.jpeg,.png",
    formats: "PDF、JPG、PNG",
  },
  {
    type: "id_card_back",
    label: "身份证反面（或外籍护照签证页）",
    required: true,
    accept: ".pdf,.jpg,.jpeg,.png",
    formats: "PDF、JPG、PNG",
  },
];

type Notice = {
  tone: "success" | "error";
  message: string;
} | null;

export function AttachmentsSection({
  attachments,
  onAttachmentsChange,
  onBusyChange,
}: AttachmentsSectionProps) {
  const [uploadingType, setUploadingType] = useState<AttachmentType | null>(
    null,
  );
  const [deletingStorageKey, setDeletingStorageKey] = useState<string | null>(
    null,
  );
  const [confirmingStorageKey, setConfirmingStorageKey] = useState<
    string | null
  >(null);
  const [notice, setNotice] = useState<Notice>(null);
  const isBusy = uploadingType !== null || deletingStorageKey !== null;

  async function handleFileSelection(
    type: AttachmentType,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    // 允许用户稍后再次选择同一个文件。
    input.value = "";

    if (!file) {
      return;
    }

    if (file.size === 0) {
      setNotice({ tone: "error", message: "上传文件不能为空" });
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setNotice({ tone: "error", message: "单个附件不能超过 10 MB" });
      return;
    }

    setUploadingType(type);
    onBusyChange(true);
    setNotice(null);

    try {
      // 每类必需附件只保留一份；先上传新文件，成功后再删除旧文件。
      const oldAttachments = attachments.filter(
        (attachment) => attachment.type === type,
      );
      const response = await uploadStudentAttachment(type, file);

      onAttachmentsChange((current) => [...current, response.attachment]);

      const failedDeletions: AttachmentMetadata[] = [];

      for (const oldAttachment of oldAttachments) {
        try {
          await deleteStudentAttachment(oldAttachment.storageKey);
          onAttachmentsChange((current) =>
            current.filter(
              (attachment) =>
                attachment.storageKey !== oldAttachment.storageKey,
            ),
          );
        } catch {
          failedDeletions.push(oldAttachment);
        }
      }

      if (failedDeletions.length > 0) {
        setNotice({
          tone: "error",
          message: "新文件已上传，但部分旧文件未能删除，请手动删除旧文件。",
        });
      } else {
        setNotice({ tone: "success", message: response.message });
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "附件上传失败",
      });
    } finally {
      setUploadingType(null);
      onBusyChange(false);
    }
  }

  async function removeAttachment(attachment: AttachmentMetadata) {
    setDeletingStorageKey(attachment.storageKey);
    onBusyChange(true);
    setNotice(null);

    try {
      const response = await deleteStudentAttachment(attachment.storageKey);
      onAttachmentsChange((current) =>
        current.filter(
          (item) => item.storageKey !== attachment.storageKey,
        ),
      );
      setConfirmingStorageKey(null);
      setNotice({ tone: "success", message: response.message });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "附件删除失败",
      });
    } finally {
      setDeletingStorageKey(null);
      onBusyChange(false);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-[#d2dee8] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.04)]">
      <div className="border-b border-[#d2dee8] px-5 py-6 sm:px-8">
        <p className="text-xs font-semibold text-[#184268]">07</p>
        <h2 className="mt-2 text-xl font-semibold">附件资料</h2>
        <p className="mt-2 text-sm leading-6 text-[#5f7285]">
          请在上传前将文件分别命名为：姓名_个人简历、姓名_身份证正面（或姓名_外籍护照首页）、姓名_身份证反面（或姓名_外籍护照签证页）。
        </p>
      </div>

      {notice ? (
        <div
          className={`mx-5 mt-6 border-l-4 px-4 py-3 text-sm sm:mx-8 ${
            notice.tone === "success"
              ? "border-[#184268] bg-[#eff5fa] text-[#244b70]"
              : "border-[#b44532] bg-[#fff3f0] text-[#873426]"
          }`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="grid gap-5 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-3">
        {attachmentRules.map((rule) => {
          const matchingAttachments = attachments.filter(
            (attachment) => attachment.type === rule.type,
          );
          const isUploading = uploadingType === rule.type;
          const hasAttachment = matchingAttachments.length > 0;

          return (
            <div
              key={rule.type}
              className="flex min-h-64 flex-col border border-[#d2dee8] bg-[#fbfcfc] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">{rule.label}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#6b7f92]">
                    {rule.formats}，不超过 10 MB
                  </p>
                </div>
                <span
                  className={`border px-2 py-1 text-xs font-medium ${
                    rule.required
                      ? "border-[#d7b4aa] bg-[#fff3f0] text-[#9a4736]"
                      : "border-[#ccd7d3] bg-white text-[#5f7285]"
                  }`}
                >
                  {rule.required ? "必需" : "选填"}
                </span>
              </div>

              <div className="mt-5 flex-1 space-y-3">
                {matchingAttachments.length === 0 ? (
                  <p className="border border-dashed border-[#c7d6e2] px-3 py-5 text-center text-sm text-[#6b7f92]">
                    尚未上传
                  </p>
                ) : (
                  matchingAttachments.map((attachment) => (
                    <div
                      key={attachment.storageKey}
                      className="border border-[#d5e0e9] bg-white px-3 py-3"
                    >
                      <p
                        className="break-all text-sm font-medium text-[#263746]"
                        title={attachment.originalName}
                      >
                        {attachment.originalName}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {confirmingStorageKey === attachment.storageKey ? (
                          <>
                            <button
                              type="button"
                              className="min-h-9 bg-[#a13f2e] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={isBusy}
                              onClick={() => removeAttachment(attachment)}
                            >
                              {deletingStorageKey === attachment.storageKey
                                ? "删除中..."
                                : "确认删除"}
                            </button>
                            <button
                              type="button"
                              className="min-h-9 border border-[#c5d3de] px-3 py-1.5 text-xs font-medium text-[#52677a]"
                              onClick={() => setConfirmingStorageKey(null)}
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="min-h-9 border border-[#d7b4aa] px-3 py-1.5 text-xs font-medium text-[#a13f2e] hover:bg-[#fff3f0]"
                            disabled={isBusy}
                            onClick={() =>
                              setConfirmingStorageKey(attachment.storageKey)
                            }
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <label
                className={`mt-5 flex min-h-11 items-center justify-center border px-4 py-2 text-center text-sm font-semibold transition ${
                  isBusy
                    ? "cursor-wait border-[#b6c4d0] bg-[#eef3f7] text-[#728394]"
                    : "cursor-pointer border-[#184268] text-[#184268] hover:bg-[#edf4fa]"
                }`}
              >
                {isBusy
                  ? isUploading
                    ? "上传中..."
                    : "请稍候..."
                  : hasAttachment
                    ? "替换文件"
                    : "选择文件"}
                <input
                  className="sr-only"
                  type="file"
                  accept={rule.accept}
                  disabled={isBusy}
                  onChange={(event) =>
                    handleFileSelection(rule.type, event)
                  }
                />
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
