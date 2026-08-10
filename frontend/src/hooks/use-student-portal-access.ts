"use client";

import { ApiError } from "@/lib/api/client";
import { getStudentPortal } from "@/lib/api/student-attendance";
import { getStudentPortalPath } from "@/lib/student-portal-routing";
import { STUDENT_SESSION_EXPIRED_PATH } from "@/lib/student-session";
import type {
  StudentPortalResponse,
  StudentPortalState,
} from "@/types/attendance";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface StudentPortalAccessState {
  portal: StudentPortalResponse | null;
  isLoading: boolean;
  errorMessage: string;
}

export function useStudentPortalAccess(
  expectedState: StudentPortalState,
): StudentPortalAccessState {
  const router = useRouter();
  const [portal, setPortal] = useState<StudentPortalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadPortal() {
      try {
        // 后端会按当前业务日期刷新学生状态，前端只负责按结果分流。
        const response = await getStudentPortal();

        if (response.portalState !== expectedState) {
          router.replace(getStudentPortalPath(response.portalState));
          return;
        }

        if (isActive) {
          setPortal(response);
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
            : "无法读取工作台状态，请稍后重试",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadPortal();

    return () => {
      isActive = false;
    };
  }, [expectedState, router]);

  return { portal, isLoading, errorMessage };
}
