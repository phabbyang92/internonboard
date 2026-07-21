"use client";

import { ApiError } from "@/lib/api/client";
import { getCurrentStudent } from "@/lib/api/student-auth";
import { getStudentForm } from "@/lib/api/student-form";
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
        // /me checks the current Cookie before any form data is requested.
        const { student } = await getCurrentStudent();
        const shouldShowSubmittedPage = student.hasSubmitted;

        if (mode === "editable" && shouldShowSubmittedPage) {
          router.replace("/student/submitted");
          return;
        }

        if (mode === "submitted" && !shouldShowSubmittedPage) {
          router.replace("/student/form");
          return;
        }

        const { form: studentForm } = await getStudentForm();

        // Check again using current database data in case status changed.
        if (mode === "editable" && studentForm.hasSubmitted) {
          router.replace("/student/submitted");
          return;
        }

        if (mode === "submitted" && !studentForm.hasSubmitted) {
          router.replace("/student/form");
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
          router.replace("/student/login");
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
