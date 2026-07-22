"use client";

import { useState, type FormEvent } from "react";

import { HrModal } from "@/components/hr/hr-modal";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { ApiError } from "@/lib/api/client";
import { createHrStudent } from "@/lib/api/hr-students";
import {
  chinaDateInputToIso,
  getEarliestOnboardingStartInput,
} from "@/lib/format-date";
import type { CreateHrStudentResponse } from "@/types/hr";
import { WORK_LOCATIONS, type WorkLocation } from "@/types/student";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function HrCreateStudentModal({ isOpen, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [workLocation, setWorkLocation] = useState<WorkLocation | "">("");
  const [startAt, setStartAt] = useState("");
  const [created, setCreated] = useState<CreateHrStudentResponse[]>([]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (Boolean(workLocation) !== Boolean(startAt)) {
      setError("如需安排入职，请同时填写工作地点和入职开始日期");
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      const result = await createHrStudent({
        name,
        email,
        ...(phone.trim() ? { phone } : {}),
        ...(workLocation && startAt
          ? {
              workLocation,
              onboardingStartAt: chinaDateInputToIso(startAt),
            }
          : {}),
      });
      setCreated((items) => [result, ...items]);
      setName("");
      setEmail("");
      setPhone("");
      setWorkLocation("");
      setStartAt("");
      onCreated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "新增学生失败");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <HrModal
      isOpen={isOpen}
      onClose={onClose}
      title="连续新增学生"
      description="可同时安排工作地点和开始日期；保存后表单会自动清空，可继续录入下一名。"
    >
      <form className="space-y-4 px-5 py-5 sm:px-6" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-[#31485c]">
            姓名
            <input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 h-11 w-full border border-[#b9c9d7] px-3 outline-none focus:border-[#184268]"
            />
          </label>
          <label className="text-sm font-medium text-[#31485c]">
            邮箱
            <input
              required
              type="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 h-11 w-full border border-[#b9c9d7] px-3 outline-none focus:border-[#184268]"
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-[#31485c]">
          手机号（选填）
          <input
            maxLength={30}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-2 h-11 w-full border border-[#b9c9d7] px-3 outline-none focus:border-[#184268]"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-[#31485c]">
            工作地点（选填）
            <select
              value={workLocation}
              onChange={(event) =>
                setWorkLocation(event.target.value as WorkLocation | "")
              }
              className="mt-2 h-11 w-full rounded-md border border-[#b9c9d7] bg-white px-3 outline-none focus:border-[#184268]"
            >
              <option value="">暂不安排</option>
              {WORK_LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-[#31485c]">
            实习开始日期（选填）
            <DatePickerInput
              min={getEarliestOnboardingStartInput()}
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-[#b9c9d7] px-3 outline-none focus:border-[#184268]"
            />
          </label>
        </div>
        <p className="text-xs text-[#6b7f92]">
          如需直接安排入职，请同时填写工作地点和开始日期；最早可选择今天前 30 天。
        </p>
        {error ? (
          <p className="text-sm text-[#9d3426]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <button
            disabled={isSaving}
            className="min-h-11 bg-[#184268] px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSaving ? "正在保存..." : "保存并继续新增"}
          </button>
        </div>
      </form>
      {created.length ? (
        <div className="border-t border-[#d5e0e9] bg-[#f7f9fb] px-5 py-4 sm:px-6">
          <p className="text-xs font-semibold text-[#52677a]">
            本次已新增 {created.length} 名
          </p>
          <ul className="mt-3 max-h-32 space-y-2 overflow-y-auto text-sm">
            {created.map((student) => (
              <li key={student.id} className="flex justify-between gap-4">
                <span>{student.name}</span>
                <span className="truncate text-[#6b7f92]">{student.email}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </HrModal>
  );
}
