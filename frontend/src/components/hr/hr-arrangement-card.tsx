"use client";

import { useState, type FormEvent } from "react";

import { DatePickerInput } from "@/components/ui/date-picker-input";
import { ApiError } from "@/lib/api/client";
import { updateHrStudentArrangement } from "@/lib/api/hr-students";
import {
  chinaDateInputToIso,
  formatDateOnly,
  getChinaTodayInput,
  toChinaDateInput,
} from "@/lib/format-date";
import type { HrStudentDetail } from "@/types/hr";
import { WORK_LOCATIONS, type WorkLocation } from "@/types/student";

interface Props {
  student: HrStudentDetail;
  onSaved: () => void;
}

export function HrArrangementCard({ student, onSaved }: Props) {
  const hasStarted =
    student.onboardingStatus === "onboarded" ||
    student.onboardingStatus === "departed";
  const [isEditing, setIsEditing] = useState(false);
  const [workLocation, setWorkLocation] = useState<WorkLocation | "">(
    student.workLocation ?? "",
  );
  const [startAt, setStartAt] = useState(
    toChinaDateInput(student.onboardingStartAt),
  );
  const [endAt, setEndAt] = useState(toChinaDateInput(student.onboardingEndAt));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!workLocation || (!hasStarted && !startAt)) {
      setError("请选择工作地点和入职开始日期");
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      await updateHrStudentArrangement(student.id, {
        ...(workLocation ? { workLocation } : {}),
        ...(!hasStarted && startAt
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
      setIsEditing(false);
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "保存入职安排失败",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[#cfdae4] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.05)]">
      <header className="flex items-center justify-between border-b border-[#d5e0e9] px-5 py-4">
        <h2 className="font-semibold">入职安排</h2>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-sm font-medium text-[#184268]"
          >
            修改安排
          </button>
        ) : null}
      </header>
      {isEditing ? (
        <form className="space-y-4 p-5" onSubmit={submit}>
          <label className="block text-xs font-semibold text-[#52677a]">
            工作地点
            <select
              required
              value={workLocation}
              onChange={(e) => setWorkLocation(e.target.value as WorkLocation)}
              className="mt-2 h-10 w-full border border-[#b9c9d7] bg-white px-3 text-sm"
            >
              <option value="">请选择</option>
              {WORK_LOCATIONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-[#52677a]">
            入职开始日期
            <DatePickerInput
              required
              disabled={hasStarted}
              min={getChinaTodayInput()}
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="mt-2 h-10 w-full border border-[#b9c9d7] px-3 text-sm disabled:bg-[#f1f4f7]"
            />
          </label>
          <label className="block text-xs font-semibold text-[#52677a]">
            实习结束日期
            <DatePickerInput
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="mt-2 h-10 w-full border border-[#b9c9d7] px-3 text-sm"
            />
          </label>
          {hasStarted ? (
            <p className="text-xs text-[#8a5a35]">
              已入职或已离职学生的开始日期不可修改，地点和结束日期仍可修改。
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
              onClick={() => setIsEditing(false)}
              className="min-h-10 border border-[#b9c9d7] px-4 text-sm"
            >
              取消
            </button>
            <button
              disabled={isSaving}
              className="min-h-10 bg-[#184268] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSaving ? "保存中..." : "保存安排"}
            </button>
          </div>
        </form>
      ) : (
        <dl className="grid gap-4 p-5 text-sm">
          <div>
            <dt className="text-xs text-[#6b7f92]">工作地点</dt>
            <dd className="mt-1 font-medium">
              {student.workLocation ?? "未安排"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#6b7f92]">入职开始日期</dt>
            <dd className="mt-1 font-medium">
              {formatDateOnly(student.onboardingStartAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#6b7f92]">实习结束日期</dt>
            <dd className="mt-1 font-medium">
              {formatDateOnly(student.onboardingEndAt)}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
