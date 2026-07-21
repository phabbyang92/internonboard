"use client";

import { useState, type FormEvent } from "react";

import { HrModal } from "@/components/hr/hr-modal";
import { ApiError } from "@/lib/api/client";
import { batchUpdateHrStudentArrangement } from "@/lib/api/hr-students";
import { chinaDateTimeInputToIso } from "@/lib/format-date";
import { WORK_LOCATIONS, type WorkLocation } from "@/types/student";

interface Props { studentIds: string[]; isOpen: boolean; onClose: () => void; onSaved: () => void }

export function HrBatchArrangementModal({ studentIds, isOpen, onClose, onSaved }: Props) {
  const [workLocation, setWorkLocation] = useState<WorkLocation | "">("");
  const [startAt, setStartAt] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!workLocation || !startAt) return;
    setError("");
    setIsSaving(true);
    try {
      await batchUpdateHrStudentArrangement({ studentIds, workLocation, onboardingStartAt: chinaDateTimeInputToIso(startAt) });
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "批量安排失败");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <HrModal isOpen={isOpen} onClose={onClose} title="批量安排入职" description={`将为已选择的 ${studentIds.length} 名学生设置相同地点和开始时间。`}>
      <form className="space-y-4 px-5 py-5 sm:px-6" onSubmit={submit}>
        <label className="block text-sm font-medium">工作地点
          <select required value={workLocation} onChange={(e) => setWorkLocation(e.target.value as WorkLocation)} className="mt-2 h-11 w-full border border-[#bdcac6] bg-white px-3">
            <option value="">请选择</option>
            {WORK_LOCATIONS.map((location) => <option key={location}>{location}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">入职开始时间
          <input required type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="mt-2 h-11 w-full border border-[#bdcac6] px-3" />
        </label>
        <p className="text-xs text-[#75817d]">已入职学生不能重新批量设置开始时间，请不要将其加入本次选择。</p>
        {error ? <p className="text-sm text-[#9d3426]" role="alert">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="min-h-11 border border-[#bdcac6] px-5 text-sm">取消</button>
          <button disabled={isSaving || studentIds.length === 0} className="min-h-11 bg-[#147565] px-5 text-sm font-semibold text-white disabled:opacity-50">{isSaving ? "正在保存..." : "确认批量安排"}</button>
        </div>
      </form>
    </HrModal>
  );
}
