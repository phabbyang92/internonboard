"use client";

import { ApiError } from "@/lib/api/client";
import { getStudentPortal } from "@/lib/api/student-attendance";
import { getStudentForm } from "@/lib/api/student-form";
import { getStudentPortalPath } from "@/lib/student-portal-routing";
import { STUDENT_SESSION_EXPIRED_PATH } from "@/lib/student-session";
import type { StudentForm } from "@/types/student";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type PageMode = "editable" | "submitted";

interface StudentFormAccessState {
  form: StudentForm | null;
  isLoading: boolean;
  errorMessage: string;
}

export function useStudentFormAccess(
  mode: PageMode,
): StudentFormAccessState {
  const router = useRouter();
  const [form, setForm] = useState<StudentForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadPage() {
      try {
        // Portal state is the single source of truth for all student entry routes.
        const portal = await getStudentPortal();
        const expectedState = mode === "editable" ? "registration" : "waiting";

        if (portal.portalState !== expectedState) {
          router.replace(getStudentPortalPath(portal.portalState));
          return;
        }

        const { form: studentForm } = await getStudentForm();

        // A mismatched form snapshot is routed through /student for a fresh decision.
        if (mode === "editable" && studentForm.hasSubmitted) {
          router.replace("/student");
          return;
        }

        if (mode === "submitted" && !studentForm.hasSubmitted) {
          router.replace("/student");
          return;
        }

        if (isActive) {
          setForm(studentForm);
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
            : "无法读取登记信息，请稍后重试",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadPage();

    return () => {
      isActive = false;
    };
  }, [mode, router]);

  return { form, isLoading, errorMessage };
}
