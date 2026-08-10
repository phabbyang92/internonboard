"use client";

import { ApiError } from "@/lib/api/client";
import { getLeaveDateOptions } from "@/lib/api/student-attendance";
import { STUDENT_SESSION_EXPIRED_PATH } from "@/lib/student-session";
import type { LeaveDateOptionsResponse } from "@/types/attendance";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface StudentLeaveOptionsState {
  options: LeaveDateOptionsResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  errorMessage: string;
  reload: () => Promise<void>;
}

export function useStudentLeaveOptions(): StudentLeaveOptionsState {
  const router = useRouter();
  const [options, setOptions] = useState<LeaveDateOptionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadInitialOptions() {
      try {
        const response = await getLeaveDateOptions();

        if (isActive) {
          setOptions(response);
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
            : "无法读取请假日期，请稍后重试",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialOptions();

    return () => {
      isActive = false;
    };
  }, [router]);

  const reload = useCallback(async () => {
    setIsRefreshing(true);
    setErrorMessage("");

    try {
      setOptions(await getLeaveDateOptions());
    } catch (error: unknown) {
      if (error instanceof ApiError && error.statusCode === 401) {
        router.replace(STUDENT_SESSION_EXPIRED_PATH);
        return;
      }

      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "无法读取请假日期，请稍后重试",
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [router]);

  return { options, isLoading, isRefreshing, errorMessage, reload };
}
