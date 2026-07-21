"use client";

import { logoutStudent } from "@/lib/api/student-auth";
import Image from "next/image";
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
    <header className="border-b border-[#d8e0dd] bg-white">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-5 px-5 sm:px-8">
        <div className="flex min-w-0 items-center">
          <Image
            src="/frost-sullivan-logo.svg"
            alt="Frost & Sullivan 沙利文"
            width={189}
            height={60}
            priority
            className="h-10 w-auto shrink-0"
          />
          <span className="ml-4 hidden truncate border-l border-[#d8e0dd] pl-4 text-sm font-semibold text-[#33443f] md:inline">
            实习生入职登记系统
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-4">
          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-medium text-[#263632]">
              {studentName}
            </p>
            <p className="truncate text-xs text-[#75817d]">{studentEmail}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="shrink-0 border border-[#bdcac6] bg-white px-3 py-2 text-sm font-medium text-[#33443f] transition hover:border-[#147565] hover:text-[#147565] focus:outline-none focus:ring-2 focus:ring-[#147565]/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingOut ? "正在退出" : "退出登录"}
          </button>
        </div>
      </div>
    </header>
  );
}
