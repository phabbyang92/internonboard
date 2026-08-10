"use client";

import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { HrModal } from "@/components/hr/hr-modal";
import { SelectInput } from "@/components/ui/select-input";
import {
  correctHrAttendanceRecord,
  normalizeHrAttendanceError,
} from "@/lib/api/hr-attendance";
import type {
  AttendanceStatus,
  CheckInMode,
} from "@/types/attendance";
import type {
  CorrectHrAttendanceRecordPayload,
  HrAttendanceRecordItem,
} from "@/types/hr-attendance";

interface HrAttendanceCorrectionModalProps {
  isOpen: boolean;
  studentId: string;
  studentName: string;
  record: HrAttendanceRecordItem | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "on_time", label: "按时" },
  { value: "late", label: "迟到" },
  { value: "leave", label: "请假" },
  { value: "absent", label: "缺勤" },
];

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  on_time: "按时",
  late: "迟到",
  leave: "请假",
  absent: "缺勤",
};

function toChinaPickerValue(value: string | null): Dayjs | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return dayjs(
    `${read("year")}-${read("month")}-${read("day")} ${read("hour")}:${read("minute")}:${read("second")}`,
  );
}

function chinaPickerValueToIso(value: Dayjs): string {
  return new Date(`${value.format("YYYY-MM-DDTHH:mm:ss")}+08:00`).toISOString();
}

function formatAttendanceDate(value: string): string {
  const date = new Date(`${value}T12:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

export function HrAttendanceCorrectionModal({
  isOpen,
  studentId,
  studentName,
  record,
  onClose,
  onSaved,
}: HrAttendanceCorrectionModalProps) {
  if (!record) return null;

  return (
    <HrAttendanceCorrectionModalContent
      key={`${record.id}-${isOpen ? "open" : "closed"}`}
      isOpen={isOpen}
      studentId={studentId}
      studentName={studentName}
      record={record}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

interface HrAttendanceCorrectionModalContentProps
  extends Omit<HrAttendanceCorrectionModalProps, "record"> {
  record: HrAttendanceRecordItem;
}

function HrAttendanceCorrectionModalContent({
  isOpen,
  studentId,
  studentName,
  record,
  onClose,
  onSaved,
}: HrAttendanceCorrectionModalContentProps) {
  const router = useRouter();
  const [status, setStatus] = useState<AttendanceStatus>(record.status);
  const [reason, setReason] = useState("");
  const [checkInAt, setCheckInAt] = useState<Dayjs | null>(() =>
    toChinaPickerValue(record.checkInAt),
  );
  const [checkInMode, setCheckInMode] = useState<CheckInMode>(
    record.checkInMode ?? "online",
  );
  const [checkInLocation, setCheckInLocation] = useState(
    record.checkInLocation ?? "",
  );
  const [isSevereLate, setIsSevereLate] = useState(
    record.status === "absent" && record.lateLevel === "severe",
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const needsCheckIn =
    status === "on_time" || status === "late" || isSevereLate;
  const isOnlineAssignment = record.assignedWorkLocation === "线上";

  function closeModal() {
    if (!isSaving) onClose();
  }

  function validateAndReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      setErrorMessage("请填写更正原因");
      return;
    }

    if (trimmedReason.length > 200) {
      setErrorMessage("更正原因不能超过 200 字");
      return;
    }

    if (needsCheckIn && (!checkInAt || !checkInMode)) {
      setErrorMessage("该状态必须填写签到时间和签到方式");
      return;
    }

    if (
      checkInAt &&
      checkInAt.format("YYYY-MM-DD") !== record.attendanceDate
    ) {
      setErrorMessage("签到时间必须属于所更正的考勤日期");
      return;
    }

    setReason(trimmedReason);
    setErrorMessage("");
    setIsConfirming(true);
  }

  function buildPayload(): CorrectHrAttendanceRecordPayload {
    const payload: CorrectHrAttendanceRecordPayload = {
      status,
      reason,
    };

    if (needsCheckIn && checkInAt) {
      payload.checkInAt = chinaPickerValueToIso(checkInAt);
      payload.checkInMode = checkInMode;

      if (checkInLocation.trim()) {
        payload.checkInLocation = checkInLocation.trim();
      }

      if (status === "absent") {
        payload.lateLevel = "severe";
      }
    }

    return payload;
  }

  async function confirmCorrection() {
    setIsSaving(true);
    setErrorMessage("");

    try {
      const response = await correctHrAttendanceRecord(
        studentId,
        record.attendanceDate,
        buildPayload(),
      );
      onSaved(response.message);
      onClose();
    } catch (error: unknown) {
      const requestError = normalizeHrAttendanceError(
        error,
        "考勤记录更正失败，请稍后重试",
      );

      if (requestError.requiresLogin) {
        router.replace("/hr/login");
        return;
      }

      setErrorMessage(requestError.message);
      setIsConfirming(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <HrModal
      isOpen={isOpen}
      onClose={closeModal}
      title={`更正 ${studentName} 的考勤`}
      description={`${formatAttendanceDate(record.attendanceDate)} · 当前状态：${
        record.status === "absent" && record.lateLevel === "severe"
          ? "严重迟到（缺勤）"
          : STATUS_LABELS[record.status]
      }`}
    >
      {isConfirming ? (
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div
            className="rounded-md border border-[#e7c594] bg-[#fff8eb] px-4 py-3 text-sm leading-6 text-[#7b4a17]"
            role="alert"
          >
            请再次确认。保存后会立即更新该学生的考勤统计，并记录操作 HR、更正时间和原因。
          </div>

          <dl className="grid overflow-hidden rounded-md border border-[#d5e0e9] sm:grid-cols-2">
            <div className="border-b border-[#e2e9ef] px-4 py-3 sm:border-r">
              <dt className="text-xs text-[#6b7f92]">学生</dt>
              <dd className="mt-1 font-medium text-[#263a4b]">{studentName}</dd>
            </div>
            <div className="border-b border-[#e2e9ef] px-4 py-3">
              <dt className="text-xs text-[#6b7f92]">考勤日期</dt>
              <dd className="mt-1 font-medium text-[#263a4b]">
                {record.attendanceDate}
              </dd>
            </div>
            <div className="border-b border-[#e2e9ef] px-4 py-3 sm:border-b-0 sm:border-r">
              <dt className="text-xs text-[#6b7f92]">更正后状态</dt>
              <dd className="mt-1 font-medium text-[#263a4b]">
                {status === "absent" && isSevereLate
                  ? "严重迟到（缺勤）"
                  : STATUS_LABELS[status]}
              </dd>
              {needsCheckIn && checkInAt ? (
                <p className="mt-1 text-xs text-[#6b7f92]">
                  {checkInAt.format("YYYY/MM/DD HH:mm")} · {checkInMode === "online" ? "线上签到" : "线下签到"}
                </p>
              ) : null}
            </div>
            <div className="px-4 py-3">
              <dt className="text-xs text-[#6b7f92]">更正原因</dt>
              <dd className="mt-1 break-words font-medium text-[#263a4b]">
                {reason}
              </dd>
            </div>
          </dl>

          {errorMessage ? (
            <p className="text-sm text-[#9d3426]" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsConfirming(false)}
              className="min-h-11 cursor-pointer rounded-md border border-[#b9c9d7] px-5 text-sm font-medium text-[#425a6e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              返回修改
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void confirmCorrection()}
              className="min-h-11 cursor-pointer rounded-md bg-[#184268] px-5 text-sm font-semibold text-white transition hover:bg-[#123653] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "正在更正..." : "确认更正"}
            </button>
          </div>
        </div>
      ) : (
        <form className="space-y-5 px-5 py-5 sm:px-6" onSubmit={validateAndReview}>
          <label className="block text-sm font-medium text-[#31485c]">
            更正后状态
            <SelectInput
              value={status}
              onChange={(value) => {
                const nextStatus = value as AttendanceStatus;
                setStatus(nextStatus);
                setIsSevereLate(
                  nextStatus === "absent" && record.lateLevel === "severe",
                );
                setErrorMessage("");
              }}
              options={STATUS_OPTIONS}
              disabled={isSaving}
              ariaLabel="选择更正后考勤状态"
              className="mt-2 min-h-11"
            />
          </label>

          {status === "absent" ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[#d5e0e9] bg-[#f7fafc] px-4 py-3 text-sm text-[#31485c]">
              <input
                type="checkbox"
                checked={isSevereLate}
                disabled={isSaving}
                onChange={(event) => {
                  setIsSevereLate(event.target.checked);
                  setErrorMessage("");
                }}
                className="mt-0.5 h-4 w-4 accent-[#184268]"
              />
              <span>
                <span className="block font-medium">记录为严重迟到</span>
                <span className="mt-1 block text-xs leading-5 text-[#6b7f92]">
                  勾选后仍按缺勤统计，但需要补充实际签到时间和签到方式。
                </span>
              </span>
            </label>
          ) : null}

          {needsCheckIn ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#31485c]">
                签到时间
                <DatePicker
                  showTime={{ format: "HH:mm" }}
                  allowClear
                  value={checkInAt}
                  defaultPickerValue={dayjs(record.attendanceDate)}
                  format="YYYY/MM/DD HH:mm"
                  disabled={isSaving}
                  disabledDate={(current) =>
                    current.format("YYYY-MM-DD") !== record.attendanceDate
                  }
                  onChange={(value) => {
                    setCheckInAt(value);
                    setErrorMessage("");
                  }}
                  aria-label="填写更正后的签到时间"
                  className="mt-2 min-h-11 w-full rounded-md border-[#b9c9d7]"
                />
              </label>

              <label className="block text-sm font-medium text-[#31485c]">
                签到方式
                <SelectInput
                  value={checkInMode}
                  onChange={(value) => {
                    setCheckInMode(value as CheckInMode);
                    setErrorMessage("");
                  }}
                  options={
                    isOnlineAssignment
                      ? [{ value: "online", label: "线上签到" }]
                      : [
                          { value: "online", label: "线上签到" },
                          { value: "offline", label: "线下签到" },
                        ]
                  }
                  disabled={isSaving}
                  ariaLabel="选择更正后的签到方式"
                  className="mt-2 min-h-11"
                />
              </label>

              <label className="block text-sm font-medium text-[#31485c] sm:col-span-2">
                实际签到地点（选填）
                <input
                  type="text"
                  maxLength={100}
                  value={checkInLocation}
                  disabled={isSaving}
                  onChange={(event) => setCheckInLocation(event.target.value)}
                  placeholder="不填写时由后端按签到方式和安排地点生成"
                  className="mt-2 min-h-11 w-full rounded-md border border-[#b9c9d7] bg-white px-3 text-sm outline-none transition focus:border-[#184268] focus:ring-2 focus:ring-[#184268]/15 disabled:bg-[#f0f4f7]"
                />
              </label>
            </div>
          ) : null}

          <label className="block text-sm font-medium text-[#31485c]">
            更正原因 <span className="text-[#b44532]">*</span>
            <textarea
              aria-required="true"
              maxLength={200}
              value={reason}
              disabled={isSaving}
              onChange={(event) => {
                setReason(event.target.value);
                setErrorMessage("");
              }}
              placeholder="例如：学生已提前请假，HR 补录请假状态"
              className="mt-2 min-h-24 w-full resize-y rounded-md border border-[#b9c9d7] bg-white p-3 text-sm outline-none transition focus:border-[#184268] focus:ring-2 focus:ring-[#184268]/15 disabled:bg-[#f0f4f7]"
            />
            <span className="mt-1 block text-right text-xs text-[#6b7f92]">
              {reason.length}/200
            </span>
          </label>

          {errorMessage ? (
            <p className="text-sm text-[#9d3426]" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={closeModal}
              className="min-h-11 cursor-pointer rounded-md border border-[#b9c9d7] px-5 text-sm font-medium text-[#425a6e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-11 cursor-pointer rounded-md bg-[#184268] px-5 text-sm font-semibold text-white transition hover:bg-[#123653] disabled:cursor-not-allowed disabled:opacity-50"
            >
              核对更正
            </button>
          </div>
        </form>
      )}
    </HrModal>
  );
}
