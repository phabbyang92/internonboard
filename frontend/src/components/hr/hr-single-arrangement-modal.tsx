"use client";

import { useState, type FormEvent } from "react";

import { HrModal } from "@/components/hr/hr-modal";
import { ApiError } from "@/lib/api/client";
import { updateHrStudentArrangement } from "@/lib/api/hr-students";
import {
  chinaDateInputToIso,
  getChinaTodayInput,
  toChinaDateInput,
} from "@/lib/format-date";
import type { HrStudentListItem } from "@/types/hr";
import { WORK_LOCATIONS, type WorkLocation } from "@/types/student";

interface Props {
  student: HrStudentListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function HrSingleArrangementModal({
  student,
  isOpen,
  onClose,
  onSaved,
}: Props) {
  const [workLocation, setWorkLocation] = useState<WorkLocation | "">(
    student?.workLocation ?? "",
  );
  const [startAt, setStartAt] = useState(
    toChinaDateInput(student?.onboardingStartAt ?? null),
  );
  const [endAt, setEndAt] = useState(
    toChinaDateInput(student?.onboardingEndAt ?? null),
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!student) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!student || !workLocation) return;

    setError("");
    setIsSaving(true);

    try {
      await updateHrStudentArrangement(student.id, {
        workLocation,
        ...(student.onboardingStatus !== "onboarded" && startAt
          ? { onboardingStartAt: chinaDateInputToIso(startAt) }
          : {}),
        ...(endAt
          ? {
              onboardingEndAt: new Date(
                `${endAt}T23:59:59+08:00`,
              ).toISOString(),
            }
          : {}),
      });
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "保存入职安排失败");
    } finally {
      setIsSaving(false);
    }
  }

  const isOnboarded = student.onboardingStatus === "onboarded";

  return (
    <HrModal
      isOpen={isOpen}
      onClose={onClose}
      title={`安排 ${student.name}`}
      description="工作地点和实习结束日期后续仍可由 HR 修改。"
    >
      <form className="space-y-4 px-5 py-5 sm:px-6" onSubmit={submit}>
        <label className="block text-sm font-medium text-[#35453f]">
          工作地点
          <select
            required
            value={workLocation}
            onChange={(event) =>
              setWorkLocation(event.target.value as WorkLocation)
            }
            className="mt-2 h-11 w-full border border-[#bdcac6] bg-white px-3"
          >
            <option value="">请选择</option>
            {WORK_LOCATIONS.map((location) => (
              <option key={location}>{location}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-[#35453f]">
          入职开始日期
          <input
            required={!isOnboarded}
            disabled={isOnboarded}
            min={getChinaTodayInput()}
            type="date"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
            className="mt-2 h-11 w-full border border-[#bdcac6] px-3 disabled:bg-[#f0f3f2] disabled:text-[#75817d]"
          />
        </label>

        <label className="block text-sm font-medium text-[#35453f]">
          实习结束日期（选填）
          <input
            type="date"
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
            className="mt-2 h-11 w-full border border-[#bdcac6] px-3"
          />
        </label>

        {isOnboarded ? (
          <p className="text-xs text-[#8a5a35]">
            该学生已经入职，入职开始日期不可修改。
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-[#9d3426]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 border border-[#bdcac6] px-5 text-sm"
          >
            取消
          </button>
          <button
            disabled={isSaving}
            className="min-h-11 bg-[#147565] px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSaving ? "正在保存..." : "保存安排"}
          </button>
        </div>
      </form>
    </HrModal>
  );
}
