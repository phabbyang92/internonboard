"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { DatePickerInput } from "@/components/ui/date-picker-input";
import { SelectInput } from "@/components/ui/select-input";
import { ApiError } from "@/lib/api/client";
import {
  changeHrStudentWorkLocation,
  getWorkLocationHistory,
  updateHrStudentArrangement,
} from "@/lib/api/hr-students";
import {
  chinaDateInputToIso,
  formatDateOnly,
  getDayAfterChinaDateInput,
  getChinaTodayInput,
  getEarliestOnboardingStartInput,
  toChinaDateInput,
} from "@/lib/format-date";
import type { HrStudentDetail } from "@/types/hr";
import { WORK_LOCATIONS, type WorkLocation } from "@/types/student";

interface Props {
  student: HrStudentDetail;
  onSaved: () => void;
}

type EditMode = "view" | "arrangement" | "location";

export function HrArrangementCard({ student, onSaved }: Props) {
  const hasStarted =
    student.onboardingStatus === "onboarded" ||
    student.onboardingStatus === "departed";
  const [mode, setMode] = useState<EditMode>("view");
  const [workLocation, setWorkLocation] = useState<WorkLocation | "">(
    student.workLocation ?? "",
  );
  const [startAt, setStartAt] = useState(
    toChinaDateInput(student.onboardingStartAt),
  );
  const [endAt, setEndAt] = useState(toChinaDateInput(student.onboardingEndAt));
  const [nextLocation, setNextLocation] = useState<WorkLocation | "">("");
  const firstLocationEndMinimum = getDayAfterChinaDateInput(
    student.onboardingStartAt,
  );
  const [locationStartMinimum, setLocationStartMinimum] = useState(
    firstLocationEndMinimum,
  );
  const [effectiveFrom, setEffectiveFrom] = useState(() => {
    const today = getChinaTodayInput();
    return firstLocationEndMinimum > today ? firstLocationEndMinimum : today;
  });
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!successMessage) return;

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  function closeEditor() {
    setError("");
    setMode("view");
  }

  async function submitArrangement(event: FormEvent) {
    event.preventDefault();

    if (!hasStarted && (!workLocation || !startAt)) {
      setError("请选择工作地点和实习开始日期");
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      await updateHrStudentArrangement(student.id, {
        ...(!hasStarted && workLocation ? { workLocation } : {}),
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
      setMode("view");
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "保存入职安排失败",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitLocationChange(event: FormEvent) {
    event.preventDefault();

    if (!nextLocation || !effectiveFrom) {
      setError("请选择新工作地点和生效日期");
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      await changeHrStudentWorkLocation(student.id, {
        workLocation: nextLocation,
        effectiveFrom: chinaDateInputToIso(effectiveFrom),
      });
      setNextLocation("");
      setMode("view");
      setSuccessMessage("工作地点变更成功");
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "变更工作地点失败",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function openLocationEditor() {
    setError("");
    setMode("location");

    try {
      const history = await getWorkLocationHistory(student.id);
      const latestStartAt = history.items[0]?.effectiveFrom;
      const minimum = getDayAfterChinaDateInput(
        latestStartAt ?? student.onboardingStartAt,
      );
      const today = getChinaTodayInput();

      setLocationStartMinimum(minimum);
      setEffectiveFrom(minimum > today ? minimum : today);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "无法读取工作地点历史",
      );
    }
  }

  return (
    <>
      {successMessage ? (
        <div
          className="fixed right-4 top-20 z-[120] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg border border-[#9bcdb8] bg-[#edf8f3] px-4 py-3 text-sm font-semibold text-[#176555] shadow-lg sm:right-8 sm:top-40"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
          {successMessage}
        </div>
      ) : null}
      <section className="overflow-hidden rounded-lg border border-[#cfdae4] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.05)]">
      <header className="flex items-center justify-between border-b border-[#d5e0e9] px-5 py-4">
        <h2 className="font-semibold">实习安排</h2>
        {mode === "view" ? (
          <button
            type="button"
            onClick={() => setMode("arrangement")}
            className="cursor-pointer text-sm font-medium text-[#184268] hover:text-[#006eb6]"
          >
            修改安排
          </button>
        ) : null}
      </header>

      {mode === "arrangement" ? (
        <form className="space-y-4 p-5" onSubmit={submitArrangement}>
          {!hasStarted ? (
            <>
              <label className="block text-xs font-semibold text-[#52677a]">
                初始工作地点
                <SelectInput
                  value={workLocation || undefined}
                  onChange={(value) =>
                    setWorkLocation(value as WorkLocation)
                  }
                  placeholder="请选择"
                  options={WORK_LOCATIONS.map((item) => ({
                    value: item,
                    label: item,
                  }))}
                  className="mt-2 min-h-10"
                />
              </label>
              <label className="block text-xs font-semibold text-[#52677a]">
                实习开始日期
                <DatePickerInput
                  required
                  min={getEarliestOnboardingStartInput()}
                  value={startAt}
                  onChange={(event) => setStartAt(event.target.value)}
                  className="mt-2 h-10 w-full rounded-md border border-[#b9c9d7] px-3 text-sm"
                />
              </label>
            </>
          ) : (
            <p className="rounded-md bg-[#f3f7fa] px-3 py-2 text-xs text-[#52677a]">
              学生已经入职，初始地点和开始日期作为历史保留；地点变化请使用“变更工作地点”。
            </p>
          )}

          <label className="block text-xs font-semibold text-[#52677a]">
            实习结束日期
            <DatePickerInput
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-[#b9c9d7] px-3 text-sm"
            />
          </label>
          {error ? (
            <p className="text-sm text-[#9d3426]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeEditor}
              className="min-h-10 cursor-pointer rounded-md border border-[#b9c9d7] px-4 text-sm"
            >
              取消
            </button>
            <button
              disabled={isSaving}
              className="min-h-10 cursor-pointer rounded-md bg-[#184268] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "保存中..." : "保存安排"}
            </button>
          </div>
        </form>
      ) : mode === "location" ? (
        <form className="space-y-4 p-5" onSubmit={submitLocationChange}>
          <div className="rounded-md bg-[#f3f7fa] px-3 py-2 text-xs text-[#52677a]">
            当前地点：{student.workLocation ?? "未安排"}
          </div>
          <label className="block text-xs font-semibold text-[#52677a]">
            新工作地点
            <SelectInput
              value={nextLocation || undefined}
              onChange={(value) =>
                setNextLocation(value as WorkLocation)
              }
              placeholder="请选择"
              options={WORK_LOCATIONS.filter(
                (location) => location !== student.workLocation,
              ).map((location) => ({
                value: location,
                label: location,
              }))}
              className="mt-2 min-h-10"
            />
          </label>
          <label className="block text-xs font-semibold text-[#52677a]">
            新地点生效日期
            <DatePickerInput
              required
              min={locationStartMinimum || undefined}
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-[#b9c9d7] px-3 text-sm"
            />
          </label>
          <p className="text-xs text-[#6b7f92]">
            新地点开始日期必须晚于上一段实习开始日期。
          </p>
          {error ? (
            <p className="text-sm text-[#9d3426]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeEditor}
              className="min-h-10 cursor-pointer rounded-md border border-[#b9c9d7] px-4 text-sm"
            >
              取消
            </button>
            <button
              disabled={isSaving}
              className="min-h-10 cursor-pointer rounded-md bg-[#184268] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "保存中..." : "确认变更"}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-5">
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="text-xs text-[#6b7f92]">当前工作地点</dt>
              <dd className="mt-1 font-medium">
                {student.workLocation ?? "未安排"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#6b7f92]">实习开始日期</dt>
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
          {hasStarted && student.workLocation ? (
            <button
              type="button"
              onClick={() => void openLocationEditor()}
              className="mt-5 min-h-10 w-full cursor-pointer rounded-md border border-[#8baac2] px-3 text-sm font-semibold text-[#184268] transition hover:border-[#184268] hover:bg-[#edf4fa]"
            >
              变更工作地点
            </button>
          ) : null}
        </div>
      )}
      </section>
    </>
  );
}
