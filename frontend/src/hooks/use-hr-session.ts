"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { getCurrentHr } from "@/lib/api/hr-auth";
import type { HrUser } from "@/types/hr";

interface HrSessionState {
  user: HrUser | null;
  isLoading: boolean;
  errorMessage: string;
}

export function useHrSession(): HrSessionState {
  const router = useRouter();
  const [user, setUser] = useState<HrUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    void getCurrentHr()
      .then(({ user: currentUser }) => {
        if (isActive) {
          setUser(currentUser);
        }
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        if (error instanceof ApiError && error.statusCode === 401) {
          router.replace("/hr/login");
          return;
        }

        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "无法确认 HR 登录状态，请稍后重试",
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [router]);

  return { user, isLoading, errorMessage };
}
