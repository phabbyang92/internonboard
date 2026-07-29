"use client";

import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { updateHrStudentMemo } from "@/lib/api/hr-students";
import { formatDateTime } from "@/lib/format-date";
import type { HrStudentDetail } from "@/types/hr";

interface Props {
  student: HrStudentDetail;
  onSaved: (student: HrStudentDetail) => void;
}

const MAX_MEMO_LENGTH = 100;

export function HrStudentMemo({ student, onSaved }: Props) {
  const initialMemo = student.hrMemo ?? "";
  const [memo, setMemo] = useState(initialMemo);
  const [savedMemo, setSavedMemo] = useState(initialMemo);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!successMessage) return;
    const timeoutId = window.setTimeout(() => setSuccessMessage(""), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  async function saveMemo(nextMemo: string, successText: string) {
    setErrorMessage("");
    setSuccessMessage("");
    setIsSaving(true);

    try {
      const updatedStudent = await updateHrStudentMemo(student.id, {
        memo: nextMemo,
      });
      const normalizedMemo = updatedStudent.hrMemo ?? "";
      setMemo(normalizedMemo);
      setSavedMemo(normalizedMemo);
      setSuccessMessage(successText);
      onSaved(updatedStudent);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "HR 备忘录保存失败",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const hasChanges = memo.trim() !== savedMemo;

  return (
    <section className="w-full max-w-[340px] justify-self-end rounded-md border border-[#b9cddd] bg-white px-3 py-2.5 shadow-[0_3px_14px_rgba(24,66,104,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#223548]">备注</h2>
        <span className="text-xs tabular-nums text-[#6b7f92]">
          {memo.length}/{MAX_MEMO_LENGTH}
        </span>
      </div>

      <textarea
        value={memo}
        onChange={(event) => {
          setMemo(event.target.value);
          setErrorMessage("");
          setSuccessMessage("");
        }}
        maxLength={MAX_MEMO_LENGTH}
        rows={2}
        className="mt-2 block w-full resize-none rounded-md border border-[#b9cddd] bg-[#fbfdff] px-3 py-1.5 text-sm leading-5 text-[#223548] outline-none transition focus:border-[#184268] focus:ring-2 focus:ring-[#184268]/15"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] text-[#6b7f92]">
          {student.hrMemoUpdatedAt
            ? `最后更新：${formatDateTime(student.hrMemoUpdatedAt)}`
            : "尚未保存备忘录"}
        </p>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            disabled={isSaving || (!memo && !savedMemo)}
            onClick={() => void saveMemo("", "HR 备忘录已清空")}
            className="min-h-8 cursor-pointer rounded-md border border-[#b9cddd] bg-white px-2.5 text-xs font-medium text-[#526a7f] transition hover:border-[#8da9bd] hover:bg-[#f3f7fa] disabled:cursor-not-allowed disabled:opacity-45"
          >
            清空
          </button>
          <button
            type="button"
            disabled={isSaving || !hasChanges}
            onClick={() => void saveMemo(memo, "HR 备忘录保存成功")}
            className="min-h-8 cursor-pointer rounded-md bg-[#184268] px-2.5 text-xs font-semibold text-white transition hover:bg-[#123653] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isSaving ? "保存中..." : "保存备注"}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-2 text-xs text-[#a33a2a]" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="mt-2 text-xs font-medium text-[#176b58]" role="status">
          {successMessage}
        </p>
      ) : null}
    </section>
  );
}
