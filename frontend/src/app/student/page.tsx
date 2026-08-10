"use client";

import { StudentPageState } from "@/components/student/student-page-state";
import { ApiError } from "@/lib/api/client";
import { getStudentPortal } from "@/lib/api/student-attendance";
import { getStudentPortalPath } from "@/lib/student-portal-routing";
import { STUDENT_SESSION_EXPIRED_PATH } from "@/lib/student-session";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function StudentPortalPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function routeToPortal() {
      try {
        const portal = await getStudentPortal();

        if (isActive) {
          router.replace(getStudentPortalPath(portal.portalState));
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
            : "无法进入工作台，请稍后重试",
        );
      }
    }

    void routeToPortal();

    return () => {
      isActive = false;
    };
  }, [router]);

  return (
    <StudentPageState
      message={errorMessage || "正在进入工作台..."}
      isError={Boolean(errorMessage)}
    />
  );
}
