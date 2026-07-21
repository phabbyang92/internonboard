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
    <div className="min-h-screen bg-[#eef3f8] text-[#172735]">
      <header className="border-b border-[#cfdae4] bg-white">
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
            <span className="ml-4 hidden truncate border-l border-[#d5e0e9] pl-4 text-sm font-semibold text-[#30475b] md:inline">
              HR 后台
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium text-[#263a4b]">
                {user.name}
              </p>
              <p className="truncate text-xs text-[#6b7f92]">
                {roleLabels[user.role]} · {user.email}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 border border-[#b9c9d7] bg-white px-3 py-2 text-sm font-medium text-[#30475b] transition hover:border-[#184268] hover:text-[#184268] focus:outline-none focus:ring-2 focus:ring-[#184268]/30 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoggingOut}
              onClick={handleLogout}
            >
              {isLoggingOut ? "正在退出" : "退出登录"}
            </button>
          </div>
        </div>

        <nav className="border-t border-[#edf2f6]" aria-label="HR 后台导航">
          <div className="mx-auto flex min-h-11 max-w-7xl items-end px-5 sm:px-8">
            <span className="border-b-2 border-[#184268] px-1 pb-2.5 text-sm font-semibold text-[#184268]">
              学生管理
            </span>
          </div>
        </nav>
      </header>

      {children}
    </div>
  );
}
