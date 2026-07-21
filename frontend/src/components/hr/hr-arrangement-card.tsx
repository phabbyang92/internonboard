"use client";

import { useState, type FormEvent } from "react";

import { ApiError } from "@/lib/api/client";
import { updateHrStudentArrangement } from "@/lib/api/hr-students";
import { chinaDateTimeInputToIso, formatDateOnly, formatDateTime, toChinaDateTimeInput } from "@/lib/format-date";
import type { HrStudentDetail } from "@/types/hr";
import { WORK_LOCATIONS, type WorkLocation } from "@/types/student";

interface Props { student: HrStudentDetail; onSaved: () => void }

export function HrArrangementCard({ student, onSaved }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [workLocation, setWorkLocation] = useState<WorkLocation | "">(student.workLocation ?? "");
  const [startAt, setStartAt] = useState(toChinaDateTimeInput(student.onboardingStartAt));
  const [endAt, setEndAt] = useState(student.onboardingEndAt?.slice(0, 10) ?? "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      await updateHrStudentArrangement(student.id, {
        ...(workLocation ? { workLocation } : {}),
        ...(startAt ? { onboardingStartAt: chinaDateTimeInputToIso(startAt) } : {}),
        ...(endAt ? { onboardingEndAt: new Date(`${endAt}T23:59:59+08:00`).toISOString() } : {}),
      });
      setIsEditing(false);
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "保存入职安排失败");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="border border-[#d3ddda] bg-white">
      <header className="flex items-center justify-between border-b border-[#d8e0dd] px-5 py-4">
        <h2 className="font-semibold">入职安排</h2>
        {!isEditing ? <button type="button" onClick={() => setIsEditing(true)} className="text-sm font-medium text-[#147565]">修改安排</button> : null}
      </header>
      {isEditing ? (
        <form className="space-y-4 p-5" onSubmit={submit}>
          <label className="block text-xs font-semibold text-[#52615d]">工作地点
            <select required value={workLocation} onChange={(e) => setWorkLocation(e.target.value as WorkLocation)} className="mt-2 h-10 w-full border border-[#bdcac6] bg-white px-3 text-sm"><option value="">请选择</option>{WORK_LOCATIONS.map((item) => <option key={item}>{item}</option>)}</select>
          </label>
          <label className="block text-xs font-semibold text-[#52615d]">入职开始时间
            <input required disabled={student.onboardingStatus === "onboarded"} type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="mt-2 h-10 w-full border border-[#bdcac6] px-3 text-sm disabled:bg-[#f1f4f3]" />
          </label>
          <label className="block text-xs font-semibold text-[#52615d]">实习结束日期
            <input type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="mt-2 h-10 w-full border border-[#bdcac6] px-3 text-sm" />
          </label>
          {student.onboardingStatus === "onboarded" ? <p className="text-xs text-[#8a5a35]">已入职学生的开始时间不可修改，地点和结束日期仍可修改。</p> : null}
          {error ? <p className="text-sm text-[#9d3426]" role="alert">{error}</p> : null}
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setIsEditing(false)} className="min-h-10 border border-[#bdcac6] px-4 text-sm">取消</button><button disabled={isSaving} className="min-h-10 bg-[#147565] px-4 text-sm font-semibold text-white disabled:opacity-50">{isSaving ? "保存中..." : "保存安排"}</button></div>
        </form>
      ) : (
        <dl className="grid gap-4 p-5 text-sm">
          <div><dt className="text-xs text-[#75817d]">工作地点</dt><dd className="mt-1 font-medium">{student.workLocation ?? "未安排"}</dd></div>
          <div><dt className="text-xs text-[#75817d]">入职开始时间</dt><dd className="mt-1 font-medium">{formatDateTime(student.onboardingStartAt)}</dd></div>
          <div><dt className="text-xs text-[#75817d]">实习结束日期</dt><dd className="mt-1 font-medium">{formatDateOnly(student.onboardingEndAt)}</dd></div>
        </dl>
      )}
    </section>
  );
}
