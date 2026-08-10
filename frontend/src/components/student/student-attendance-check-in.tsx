"use client";

import { ApiError } from "@/lib/api/client";
import { checkInStudentAttendance } from "@/lib/api/student-attendance";
import {
  clearAttendanceDeviceId,
  getOrCreateAttendanceDeviceId,
} from "@/lib/attendance-device";
import { STUDENT_SESSION_EXPIRED_PATH } from "@/lib/student-session";
import type {
  CheckInMode,
  StudentAttendanceTodayResponse,
} from "@/types/attendance";
import { Modal } from "antd";
import { Check, Laptop, Wifi } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface StudentAttendanceCheckInProps {
  today: StudentAttendanceTodayResponse;
  onStatusRefresh: () => Promise<void>;
}

interface FeedbackMessage {
  type: "success" | "error";
  message: string;
}

const CHECK_IN_MODE_LABELS: Record<CheckInMode, string> = {
  online: "线上签到",
  offline: "线下签到",
};

const CHECK_IN_ERROR_MESSAGES: Partial<Record<string, string>> = {
  OFFICE_NETWORK_REQUIRED: "请连上办公室 Wi-Fi 后再登记出勤。",
  STUDENT_ALREADY_CHECKED_IN: "你今天已经完成出勤登记，不能重复打卡。",
  DEVICE_ALREADY_USED:
    "该设备今天已经用于其他出勤登记，请使用尚未登记过的设备。",
  CHECK_IN_WINDOW_CLOSED: "已过打卡时间，无法打卡，今日记缺勤。",
  CHECK_IN_MODE_NOT_ALLOWED: "当前工作地点不允许所选签到方式。",
  ATTENDANCE_NOT_REQUIRED: "今天无需登记出勤。",
  STUDENT_NOT_ONBOARDED: "当前不在有效实习期内，不能登记出勤。",
  LEAVE_ALREADY_REGISTERED: "今天已经登记请假，不能重复打卡。",
  INVALID_DEVICE_ID: "设备标识无效，请重新尝试。",
};

function getCheckInErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error && error.message.includes("设备标识")
      ? "无法识别当前设备，请允许浏览器使用本地存储后重试。"
      : "签到失败，请稍后重试。";
  }

  return (
    (error.code ? CHECK_IN_ERROR_MESSAGES[error.code] : undefined) ??
    error.message
  );
}

function getUnavailableMessage(
  today: StudentAttendanceTodayResponse,
): string {
  if (!today.assignedWorkLocation) {
    return "今天尚未安排有效工作地点，请联系 HR 确认安排。";
  }

  if (!today.isWorkday) {
    return "今天是非工作日，无需进行出勤登记。";
  }

  if (today.status === "leave") {
    return "今天已登记请假，无需重复登记出勤。";
  }

  if (today.status === "absent") {
    return "今天已记录为缺勤，无法继续登记出勤。";
  }

  if (today.status === "on_time" || today.status === "late") {
    return "今天已完成出勤登记。";
  }

  if (today.checkInWindow === "closed") {
    return "已过打卡时间，无法继续登记出勤。";
  }

  return "当前没有可用签到方式。";
}

export function StudentAttendanceCheckIn({
  today,
  onStatusRefresh,
}: StudentAttendanceCheckInProps) {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<CheckInMode | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const validSelectedMode =
    selectedMode && today.allowedCheckInModes.includes(selectedMode)
      ? selectedMode
      : null;
  const canCheckIn =
    today.status === "pending" &&
    today.isWorkday &&
    today.checkInWindow === "open" &&
    today.allowedCheckInModes.length > 0;

  function selectMode(mode: CheckInMode) {
    if (!canCheckIn || isSubmitting) {
      return;
    }

    setSelectedMode(mode);
    setFeedback(null);
  }

  async function submitCheckIn() {
    if (!validSelectedMode || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const deviceId = getOrCreateAttendanceDeviceId();
      const response = await checkInStudentAttendance({
        checkInMode: validSelectedMode,
        deviceId,
      });

      setIsConfirmationOpen(false);
      setFeedback({ type: "success", message: response.message });
      await onStatusRefresh();
    } catch (error: unknown) {
      if (error instanceof ApiError && error.statusCode === 401) {
        router.replace(STUDENT_SESSION_EXPIRED_PATH);
        return;
      }

      if (error instanceof ApiError && error.code === "INVALID_DEVICE_ID") {
        clearAttendanceDeviceId();
      }

      setIsConfirmationOpen(false);
      setFeedback({ type: "error", message: getCheckInErrorMessage(error) });

      // These conflicts may create or reveal a final record; refresh the panel.
      if (
        error instanceof ApiError &&
        [
          "STUDENT_ALREADY_CHECKED_IN",
          "LEAVE_ALREADY_REGISTERED",
          "CHECK_IN_WINDOW_CLOSED",
        ].includes(error.code ?? "")
      ) {
        await onStatusRefresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="border-t border-[#e0e8ef] pt-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-[#6b7f92]">签到方式</p>
          {canCheckIn ? (
            <p className="mt-1 text-sm text-[#52677a]">
              请选择今天实际使用的签到方式。
            </p>
          ) : null}
        </div>
      </div>

      {today.allowedCheckInModes.length > 0 ? (
        <div
          className="mt-3 grid gap-3 sm:grid-cols-2"
          role={canCheckIn ? "radiogroup" : undefined}
          aria-label="签到方式"
        >
          {today.allowedCheckInModes.map((mode) => {
            const isSelected = validSelectedMode === mode;
            const needsOfficeNetwork =
              today.officeNetworkRequiredFor.includes(mode);
            const Icon = mode === "online" ? Laptop : Wifi;

            return (
              <button
                key={mode}
                type="button"
                role={canCheckIn ? "radio" : undefined}
                aria-checked={canCheckIn ? isSelected : undefined}
                disabled={!canCheckIn || isSubmitting}
                onClick={() => selectMode(mode)}
                className={`relative flex min-h-20 items-center gap-3 rounded-md border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[#184268]/20 ${
                  isSelected
                    ? "border-[#184268] bg-[#edf4fa] shadow-[0_0_0_1px_#184268]"
                    : "border-[#c5d5e2] bg-[#f9fbfd]"
                } ${canCheckIn ? "hover:border-[#527fa4] hover:bg-[#f2f7fb]" : "cursor-default opacity-80"}`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white text-[#184268] shadow-sm">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#203446]">
                    {CHECK_IN_MODE_LABELS[mode]}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-[#6b7f92]">
                    {needsOfficeNetwork
                      ? "需要连接当前办公室 Wi-Fi"
                      : "不校验办公室网络"}
                  </span>
                </span>
                {isSelected ? (
                  <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-[#184268] text-white">
                    <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-sm leading-6 text-[#6b7f92]">
          {getUnavailableMessage(today)}
        </p>
      )}

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

      {canCheckIn ? (
        <button
          type="button"
          disabled={!validSelectedMode || isSubmitting}
          onClick={() => setIsConfirmationOpen(true)}
          className="mt-4 min-h-11 w-full rounded-md bg-[#184268] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#123653] focus:outline-none focus:ring-2 focus:ring-[#184268] focus:ring-offset-2 disabled:bg-[#9cb0c1]"
        >
          {isSubmitting ? "正在登记..." : "确认出勤登记"}
        </button>
      ) : null}

      <Modal
        open={isConfirmationOpen}
        title={
          validSelectedMode === "offline" ? "确认线下签到" : "确认线上签到"
        }
        okText="确认登记"
        cancelText="返回"
        confirmLoading={isSubmitting}
        okButtonProps={{ disabled: !validSelectedMode }}
        closable={!isSubmitting}
        mask={{ closable: !isSubmitting }}
        keyboard={!isSubmitting}
        destroyOnHidden
        onCancel={() => {
          if (!isSubmitting) {
            setIsConfirmationOpen(false);
          }
        }}
        onOk={submitCheckIn}
      >
        <p className="py-2 text-sm leading-6 text-[#52677a]">
          {validSelectedMode === "offline"
            ? "请确认已连接当前办公室 Wi-Fi。系统会校验办公室公网 IP，不匹配时无法完成线下签到。"
            : "请确认今天实际为线上出勤。提交后，当天不能再次签到。"}
        </p>
      </Modal>
    </div>
  );
}
