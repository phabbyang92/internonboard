"use client";

import { ApiError } from "@/lib/api/client";
import { getStudentAttendanceRecords } from "@/lib/api/student-attendance";
import { STUDENT_SESSION_EXPIRED_PATH } from "@/lib/student-session";
import type { StudentAttendanceRecordsResponse } from "@/types/attendance";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface RecordsError {
  month: string;
  message: string;
}

interface StudentAttendanceRecordsState {
  records: StudentAttendanceRecordsResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  errorMessage: string;
  refresh: () => Promise<void>;
}

export function useStudentAttendanceRecords(
  month: string,
): StudentAttendanceRecordsState {
  const router = useRouter();
  const [response, setResponse] =
    useState<StudentAttendanceRecordsResponse | null>(null);
  const [requestError, setRequestError] = useState<RecordsError | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadRecords() {
      try {
        const nextResponse = await getStudentAttendanceRecords(month);

        if (isActive) {
          setResponse(nextResponse);
          setRequestError(null);
        }
      } catch (error: unknown) {
        if (!isActive) {
          return;
        }

        if (error instanceof ApiError && error.statusCode === 401) {
          router.replace(STUDENT_SESSION_EXPIRED_PATH);
          return;
        }

        setRequestError({
          month,
          message:
            error instanceof ApiError
              ? error.message
              : "无法读取出勤记录，请稍后重试",
        });
      }
    }

    void loadRecords();

    return () => {
      isActive = false;
    };
  }, [month, router]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      setResponse(await getStudentAttendanceRecords(month));
      setRequestError(null);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.statusCode === 401) {
        router.replace(STUDENT_SESSION_EXPIRED_PATH);
        return;
      }

      setRequestError({
        month,
        message:
          error instanceof ApiError
            ? error.message
            : "无法读取出勤记录，请稍后重试",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [month, router]);

  const records = response?.month === month ? response : null;
  const errorMessage =
    requestError?.month === month ? requestError.message : "";

  return {
    records,
    isLoading: !records && !errorMessage,
    isRefreshing,
    errorMessage,
    refresh,
  };
}
