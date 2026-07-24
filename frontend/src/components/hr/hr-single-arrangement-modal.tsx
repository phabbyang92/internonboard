"use client";

import { useState, type FormEvent } from "react";

import { HrModal } from "@/components/hr/hr-modal";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { SelectInput } from "@/components/ui/select-input";
import { ApiError } from "@/lib/api/client";
import { updateHrStudentArrangement } from "@/lib/api/hr-students";
import {
  chinaDateInputToIso,
  getEarliestOnboardingStartInput,
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
    if (
      !student ||
      !workLocation ||
      (student.onboardingStatus !== "onboarded" &&
        student.onboardingStatus !== "departed" &&
        !startAt)
    ) {
      setError("请选择工作地点和实习开始日期");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      await updateHrStudentArrangement(student.id, {
        ...(!hasStarted ? { workLocation } : {}),
        ...(student.onboardingStatus !== "onboarded" &&
        student.onboardingStatus !== "departed" &&
        startAt
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
      setError(
        caught instanceof ApiError ? caught.message : "保存入职安排失败",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const hasStarted =
    student.onboardingStatus === "onboarded" ||
    student.onboardingStatus === "departed";

  return (
    <HrModal
      isOpen={isOpen}
      onClose={onClose}
      title={`安排 ${student.name}`}
      description="工作地点和实习结束日期后续仍可由 HR 修改。"
    >
      <form className="space-y-4 px-5 py-5 sm:px-6" onSubmit={submit}>
        {!hasStarted ? (
          <label className="block text-sm font-medium text-[#31485c]">
            初始工作地点
            <SelectInput
              value={workLocation || undefined}
              onChange={(value) =>
                setWorkLocation(value as WorkLocation)
              }
              placeholder="请选择"
              options={WORK_LOCATIONS.map((location) => ({
                value: location,
                label: location,
              }))}
              className="mt-2 min-h-11"
            />
          </label>
        ) : null}

        <label className="block text-sm font-medium text-[#31485c]">
          实习开始日期
          <DatePickerInput
            required={!hasStarted}
            disabled={hasStarted}
            min={getEarliestOnboardingStartInput()}
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
            className="mt-2 h-11 w-full border border-[#b9c9d7] px-3 disabled:bg-[#f0f4f7] disabled:text-[#6b7f92]"
          />
        </label>

        <label className="block text-sm font-medium text-[#31485c]">
          实习结束日期（选填）
          <DatePickerInput
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
            className="mt-2 h-11 w-full border border-[#b9c9d7] px-3"
          />
        </label>

        {hasStarted ? (
          <p className="text-xs text-[#8a5a35]">
            该学生已经入职或离职，初始地点和开始日期不可修改。地点变化请进入学生详情使用“变更工作地点”。
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
            className="min-h-11 border border-[#b9c9d7] px-5 text-sm"
          >
            取消
          </button>
          <button
            disabled={isSaving}
            className="min-h-11 bg-[#184268] px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSaving ? "正在保存..." : "保存安排"}
          </button>
        </div>
      </form>
    </HrModal>
  );
}
