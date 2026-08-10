"use client";

import { useStudentLeaveOptions } from "@/hooks/use-student-leave-options";
import { ApiError } from "@/lib/api/client";
import {
  cancelStudentLeave,
  registerStudentLeave,
} from "@/lib/api/student-attendance";
import { STUDENT_SESSION_EXPIRED_PATH } from "@/lib/student-session";
import type { LeaveDateOption } from "@/types/attendance";
import { Modal } from "antd";
import {
  CalendarCheck2,
  Check,
  Info,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface FeedbackMessage {
  type: "success" | "error";
  message: string;
}

const LEAVE_ERROR_MESSAGES: Partial<Record<string, string>> = {
  INVALID_LEAVE_DATE: "请选择有效的请假日期。",
  LEAVE_DATE_OUT_OF_RANGE: "请假日期只能选择今天至未来两周以内。",
  STUDENT_NOT_ONBOARDED: "当前不在有效实习期内，不能登记请假。",
  ATTENDANCE_NOT_REQUIRED: "所选日期无需出勤，不能登记请假。",
  LEAVE_ALREADY_REGISTERED: "所选日期中已有请假记录，请刷新后重试。",
  ATTENDANCE_ALREADY_RECORDED:
    "所选日期中已有出勤或缺勤记录，不能登记请假。",
  LEAVE_CANCELLATION_DATE_NOT_FUTURE: "只能撤销晚于今天的请假记录。",
  LEAVE_RECORD_NOT_FOUND: "未找到可撤销的请假记录。",
  LEAVE_NOT_CANCELLABLE: "该记录不能由学生撤销。",
};

function getLeaveErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "操作失败，请稍后重试。";
  }

  return (
    (error.code ? LEAVE_ERROR_MESSAGES[error.code] : undefined) ??
    error.message
  );
}

function formatLeaveDate(value: string, includeYear = true): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return value;
  }

  const [, year, month, day] = match;
  const date = new Date(`${value}T12:00:00+08:00`);
  const weekday = Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("zh-CN", {
        weekday: "short",
        timeZone: "Asia/Shanghai",
      }).format(date);

  return `${includeYear ? `${year}年` : ""}${Number(month)}月${Number(day)}日${weekday ? ` ${weekday}` : ""}`;
}

function getLeaveDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return { year: "", monthDay: value, weekday: "" };
  }

  const [, year, month, day] = match;
  const date = new Date(`${value}T12:00:00+08:00`);
  const weekday = Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("zh-CN", {
        weekday: "short",
        timeZone: "Asia/Shanghai",
      }).format(date);

  return {
    year,
    monthDay: `${Number(month)}月${Number(day)}日`,
    weekday,
  };
}

function LeaveDateCard({
  item,
  today,
  selected,
  disabled,
  onToggle,
  onCancel,
}: {
  item: LeaveDateOption;
  today: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  onCancel: () => void;
}) {
  const isExistingLeave = item.reason === "leave_already_registered";
  const canCancel = isExistingLeave && item.attendanceDate > today;
  const dateParts = getLeaveDateParts(item.attendanceDate);
  const cardClassName = `relative flex h-[112px] flex-col rounded-lg border p-3 transition ${
    selected
      ? "border-[#184268] bg-[#edf4fa] shadow-[0_0_0_1px_#184268]"
      : isExistingLeave
        ? "border-[#a9c5da] bg-[#f4f8fb]"
        : item.selectable
          ? "border-[#cbd9e4] bg-white hover:border-[#7ea4c1] hover:bg-[#f8fbfd]"
          : "border-[#dce4ea] bg-[#f7f9fb]"
  }`;
  return (
    <div className={cardClassName}>
      {item.selectable ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          disabled={disabled}
          onClick={onToggle}
          className="absolute inset-0 z-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#184268]/25 disabled:cursor-not-allowed"
          aria-label={`${formatLeaveDate(item.attendanceDate)}，${selected ? "取消选择" : "选择请假"}`}
        />
      ) : null}
      <div
        className={`flex min-h-0 flex-1 flex-col ${item.selectable ? "pointer-events-none" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <p className="text-sm font-semibold text-[#203446]">
                {dateParts.monthDay}
              </p>
              <span className="text-[11px] text-[#617589]">
                {dateParts.weekday}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] leading-4 text-[#8292a0]">
              {dateParts.year}
            </p>
          </div>
          {selected ? (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#184268] text-white">
              <Check size={12} strokeWidth={2.5} aria-hidden="true" />
            </span>
          ) : null}
        </div>

        <p
          className={`mt-1 truncate text-[11px] leading-4 ${
            item.selectable
              ? "text-[#2f6f5d]"
              : isExistingLeave
                ? "text-[#184268]"
                : "text-[#7a8b99]"
          }`}
          title={item.message}
        >
          {item.message}
        </p>

        <div className="mt-auto flex min-w-0 items-center justify-between gap-2 border-t border-[#dfe8ef] pt-2">
          <span
            className="min-w-0 truncate text-[11px] font-medium text-[#52677a]"
            title={item.workLocation || undefined}
          >
            {item.workLocation || "—"}
          </span>
          {canCancel ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onCancel}
              title="撤销请假"
              aria-label={`撤销 ${formatLeaveDate(item.attendanceDate)} 的请假`}
              className="pointer-events-auto relative z-20 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#d9a59c] bg-white text-[#9d3426] transition hover:border-[#c94f3d] hover:bg-[#fff3f1] focus:outline-none focus:ring-2 focus:ring-[#c94f3d]/20 disabled:opacity-60"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function StudentLeaveRegistration() {
  const router = useRouter();
  const {
    options,
    isLoading,
    isRefreshing,
    errorMessage,
    reload,
  } = useStudentLeaveOptions();
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isSubmitConfirmationOpen, setIsSubmitConfirmationOpen] =
    useState(false);
  const [cancellingDate, setCancellingDate] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const selectedDateSet = useMemo(
    () => new Set(selectedDates),
    [selectedDates],
  );

  function toggleDate(attendanceDate: string) {
    if (isMutating) {
      return;
    }

    setSelectedDates((current) =>
      current.includes(attendanceDate)
        ? current.filter((date) => date !== attendanceDate)
        : [...current, attendanceDate].sort(),
    );
    setFeedback(null);
  }

  async function submitLeave() {
    if (selectedDates.length === 0 || isMutating) {
      return;
    }

    setIsMutating(true);
    setFeedback(null);

    try {
      const response = await registerStudentLeave({ dates: selectedDates });
      setIsSubmitConfirmationOpen(false);
      setSelectedDates([]);
      setFeedback({
        type: "success",
        message: `已成功登记 ${response.dates.length} 天请假。`,
      });
      await reload();
    } catch (error: unknown) {
      if (error instanceof ApiError && error.statusCode === 401) {
        setIsSubmitConfirmationOpen(false);
        router.replace(STUDENT_SESSION_EXPIRED_PATH);
        return;
      }

      setIsSubmitConfirmationOpen(false);
      setFeedback({ type: "error", message: getLeaveErrorMessage(error) });

      if (
        error instanceof ApiError &&
        ["LEAVE_ALREADY_REGISTERED", "ATTENDANCE_ALREADY_RECORDED"].includes(
          error.code ?? "",
        )
      ) {
        await reload();
      }
    } finally {
      setIsMutating(false);
    }
  }

  async function cancelLeave() {
    if (!cancellingDate || isMutating) {
      return;
    }

    const dateToCancel = cancellingDate;
    setIsMutating(true);
    setFeedback(null);

    try {
      await cancelStudentLeave(dateToCancel);
      setCancellingDate(null);
      setFeedback({
        type: "success",
        message: `已撤销 ${formatLeaveDate(dateToCancel)} 的请假。`,
      });
      await reload();
    } catch (error: unknown) {
      if (error instanceof ApiError && error.statusCode === 401) {
        setCancellingDate(null);
        router.replace(STUDENT_SESSION_EXPIRED_PATH);
        return;
      }

      setCancellingDate(null);
      setFeedback({ type: "error", message: getLeaveErrorMessage(error) });
      await reload();
    } finally {
      setIsMutating(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-lg border border-[#d2dee8] bg-white px-6 py-12 text-center shadow-[0_4px_18px_rgba(24,66,104,0.05)]">
        <RefreshCw
          className="mx-auto animate-spin text-[#52708a]"
          size={24}
          aria-hidden="true"
        />
        <p className="mt-3 text-sm text-[#5f7285]">正在读取请假日期...</p>
      </section>
    );
  }

  if (errorMessage || !options) {
    return (
      <section className="rounded-lg border border-[#e4b7af] bg-white px-6 py-10 text-center shadow-[0_4px_18px_rgba(24,66,104,0.05)]">
        <p className="text-sm text-[#9d3426]" role="alert">
          {errorMessage || "暂时无法读取请假日期"}
        </p>
        <button
          type="button"
          className="mt-5 rounded-md border border-[#b9c9d7] bg-white px-4 py-2 text-sm font-semibold text-[#184268] transition hover:border-[#184268] hover:bg-[#edf4fa] focus:outline-none focus:ring-2 focus:ring-[#184268]/20"
          onClick={() => void reload()}
        >
          重新加载
        </button>
      </section>
    );
  }

  return (
    <div>
      <section className="rounded-lg border border-[#efb0a8] bg-[#fff1ef] px-5 py-3.5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#c94f3d] text-white shadow-sm">
            <Info size={17} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[#8f2e22]">请假登记说明</h2>
            <p className="mt-1 text-sm leading-6 text-[#753a32]">
              请假先与带教分析师对接，后告知 HR 并在登记表记为请假状态。
            </p>
            <p className="mt-0.5 text-xs leading-5 text-[#9d4a3e]">
              可选择今天至未来 {options.maxDaysAhead} 天内的多个有效工作日。
            </p>
          </div>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#203446]">选择请假日期</h2>
          <p className="mt-1 text-sm text-[#6b7f92]">
            已选择 {selectedDates.length} 天
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="刷新请假日期"
            aria-label="刷新请假日期"
            disabled={isRefreshing || isMutating}
            onClick={() => void reload()}
            className="grid h-10 w-10 place-items-center rounded-md border border-[#c5d5e2] bg-white text-[#52708a] transition hover:border-[#184268] hover:bg-[#edf4fa] hover:text-[#184268] focus:outline-none focus:ring-2 focus:ring-[#184268]/20 disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              className={isRefreshing ? "animate-spin" : ""}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            disabled={selectedDates.length === 0 || isMutating}
            onClick={() => setIsSubmitConfirmationOpen(true)}
            className="min-h-10 rounded-md bg-[#184268] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#123653] focus:outline-none focus:ring-2 focus:ring-[#184268] focus:ring-offset-2 disabled:bg-[#9cb0c1]"
          >
            提交请假
          </button>
        </div>
      </div>

      {feedback ? (
        <div
          className={`mt-4 rounded-md border px-4 py-3 text-sm leading-6 ${
            feedback.type === "success"
              ? "border-[#9bd0bd] bg-[#eef9f4] text-[#176555]"
              : "border-[#e4a99f] bg-[#fff3f1] text-[#9d3426]"
          }`}
          role={feedback.type === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {options.items.map((item) => (
          <LeaveDateCard
            key={item.attendanceDate}
            item={item}
            today={options.startDate}
            selected={selectedDateSet.has(item.attendanceDate)}
            disabled={isMutating}
            onToggle={() => toggleDate(item.attendanceDate)}
            onCancel={() => setCancellingDate(item.attendanceDate)}
          />
        ))}
      </div>

      <Modal
        open={isSubmitConfirmationOpen}
        title="确认提交请假"
        okText="确认提交"
        cancelText="返回修改"
        confirmLoading={isMutating}
        closable={!isMutating}
        mask={{ closable: !isMutating }}
        keyboard={!isMutating}
        destroyOnHidden
        onCancel={() => {
          if (!isMutating) {
            setIsSubmitConfirmationOpen(false);
          }
        }}
        onOk={submitLeave}
      >
        <p className="py-2 text-sm leading-6 text-[#52677a]">
          将登记以下 {selectedDates.length} 个请假日期：
        </p>
        <div className="flex flex-wrap gap-2 pb-2">
          {selectedDates.map((date) => (
            <span
              key={date}
              className="rounded-md bg-[#edf4fa] px-2.5 py-1 text-xs font-medium text-[#184268]"
            >
              {formatLeaveDate(date)}
            </span>
          ))}
        </div>
      </Modal>

      <Modal
        open={Boolean(cancellingDate)}
        title="确认撤销请假"
        okText="确认撤销"
        cancelText="取消"
        confirmLoading={isMutating}
        okButtonProps={{ danger: true }}
        closable={!isMutating}
        mask={{ closable: !isMutating }}
        keyboard={!isMutating}
        destroyOnHidden
        onCancel={() => {
          if (!isMutating) {
            setCancellingDate(null);
          }
        }}
        onOk={cancelLeave}
      >
        <div className="flex items-start gap-3 py-2 text-sm leading-6 text-[#52677a]">
          <CalendarCheck2
            className="mt-0.5 shrink-0 text-[#9d3426]"
            size={18}
            aria-hidden="true"
          />
          <p>
            确认撤销
            <strong className="mx-1 font-semibold text-[#203446]">
              {cancellingDate ? formatLeaveDate(cancellingDate) : ""}
            </strong>
            的请假登记？撤销后，该日期将恢复为需要正常考勤。
          </p>
        </div>
      </Modal>
    </div>
  );
}
