"use client";

import { logoutStudent } from "@/lib/api/student-auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface StudentPageHeaderProps {
  studentName: string;
  studentEmail: string;
}

export function StudentPageHeader({
  studentName,
  studentEmail,
}: StudentPageHeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logoutStudent();
    } finally {
      router.replace("/student/login");
      router.refresh();
    }
  }

  return (
    <header className="border-b border-[#d5e0e9] bg-white">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-5 px-5 sm:px-8">
        <div className="flex min-w-0 items-center">
          <span className="truncate text-sm font-semibold text-[#30475b]">
            学生入职登记系统
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-4">
          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-medium text-[#263a4b]">
              {studentName}
            </p>
            <p className="truncate text-xs text-[#6b7f92]">{studentEmail}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="shrink-0 border border-[#b9c9d7] bg-white px-3 py-2 text-sm font-medium text-[#30475b] transition hover:border-[#184268] hover:text-[#184268] focus:outline-none focus:ring-2 focus:ring-[#184268]/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingOut ? "正在退出" : "退出登录"}
          </button>
        </div>
      </div>
    </header>
  );
}
