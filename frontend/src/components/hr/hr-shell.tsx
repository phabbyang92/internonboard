"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

const navigationItems = [
  { href: "/hr/students", activePrefix: "/hr/students", label: "学生管理" },
  {
    href: "/hr/attendance/daily",
    activePrefix: "/hr/attendance",
    label: "出勤管理",
  },
  {
    href: "/hr/shared-document",
    activePrefix: "/hr/shared-document",
    label: "共享文档",
  },
] as const;

export function HrShell({ user, children }: HrShellProps) {
  const router = useRouter();
  const pathname = usePathname();
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
            <span className="truncate text-sm font-semibold text-[#30475b]">
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
              className="shrink-0 rounded-md border border-[#b9c9d7] bg-white px-3 py-2 text-sm font-medium text-[#30475b] transition hover:border-[#184268] hover:text-[#184268] focus:outline-none focus:ring-2 focus:ring-[#184268]/30 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoggingOut}
              onClick={handleLogout}
            >
              {isLoggingOut ? "正在退出" : "退出登录"}
            </button>
          </div>
        </div>

        <nav
          className="overflow-x-auto border-t border-[#edf2f6]"
          aria-label="HR 后台导航"
        >
          <div className="mx-auto flex min-h-11 w-max min-w-full max-w-7xl items-end gap-5 px-5 sm:gap-7 sm:px-8">
            {navigationItems.map((item) => {
              const isActive = pathname.startsWith(item.activePrefix);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`shrink-0 border-b-2 px-1 pb-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#184268]/30 ${
                    isActive
                      ? "border-[#184268] text-[#184268]"
                      : "border-transparent text-[#60758a] hover:border-[#9db3c6] hover:text-[#184268]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {children}
    </div>
  );
}
