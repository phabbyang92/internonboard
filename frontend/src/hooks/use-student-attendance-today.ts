"use client";

import { ApiError } from "@/lib/api/client";
import { getTodayAttendance } from "@/lib/api/student-attendance";
import { STUDENT_SESSION_EXPIRED_PATH } from "@/lib/student-session";
import type { StudentAttendanceTodayResponse } from "@/types/attendance";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface StudentAttendanceTodayState {
  today: StudentAttendanceTodayResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  errorMessage: string;
  refresh: () => Promise<void>;
}

export function useStudentAttendanceToday(): StudentAttendanceTodayState {
  const router = useRouter();
  const [today, setToday] = useState<StudentAttendanceTodayResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadInitialToday() {
      try {
        const response = await getTodayAttendance();

        if (isActive) {
          setToday(response);
        }
      } catch (error: unknown) {
        if (!isActive) {
          return;
        }

        if (error instanceof ApiError && error.statusCode === 401) {
          router.replace(STUDENT_SESSION_EXPIRED_PATH);
          return;
        }

        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "无法读取今日考勤，请稍后重试",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialToday();

    return () => {
      isActive = false;
    };
  }, [router]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setErrorMessage("");

    try {
      const response = await getTodayAttendance();
      setToday(response);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.statusCode === 401) {
        router.replace(STUDENT_SESSION_EXPIRED_PATH);
        return;
      }

      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "无法读取今日考勤，请稍后重试",
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [router]);

  return {
    today,
    isLoading,
    isRefreshing,
    errorMessage,
    refresh,
  };
}
