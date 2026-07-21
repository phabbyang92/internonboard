"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { logoutHr } from "@/lib/api/hr-auth";
import type { HrUser } from "@/types/hr";

interface HrShellProps {
  user: HrUser;
  children: ReactNode;
}

const roleLabels: Record<HrUser["role"], string> = {
  admin: "管理员",
  hr: "HR",
};

export function HrShell({ user, children }: HrShellProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logoutHr();
    } finally {
      router.replace("/hr/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-[#edf2f0] text-[#17221f]">
      <header className="border-b border-[#d3ddda] bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
          <div className="flex min-w-0 items-center">
            <Image
              src="/frost-sullivan-logo.svg"
              alt="Frost & Sullivan 沙利文"
              width={189}
              height={60}
              priority
              className="h-9 w-auto shrink-0"
            />
            <span className="ml-4 hidden truncate border-l border-[#d8e0dd] pl-4 text-sm font-semibold text-[#33443f] md:inline">
              HR 后台
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium text-[#263632]">
                {user.name}
              </p>
              <p className="truncate text-xs text-[#75817d]">
                {roleLabels[user.role]} · {user.email}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 border border-[#bdcac6] bg-white px-3 py-2 text-sm font-medium text-[#33443f] transition hover:border-[#147565] hover:text-[#147565] focus:outline-none focus:ring-2 focus:ring-[#147565]/30 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoggingOut}
              onClick={handleLogout}
            >
              {isLoggingOut ? "正在退出" : "退出登录"}
            </button>
          </div>
        </div>

        <nav className="border-t border-[#edf1f0]" aria-label="HR 后台导航">
          <div className="mx-auto flex min-h-11 max-w-7xl items-end px-5 sm:px-8">
            <span className="border-b-2 border-[#147565] px-1 pb-2.5 text-sm font-semibold text-[#147565]">
              学生管理
            </span>
          </div>
        </nav>
      </header>

      {children}
    </div>
  );
}
