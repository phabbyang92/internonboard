"use client";

import { useEffect, useState } from "react";

import { listHrUsers } from "@/lib/api/hr-auth";
import type { HrStudentDetail, HrUser } from "@/types/hr";

interface Props {
  currentUser: HrUser;
  student: HrStudentDetail;
}

export function HrStudentOwnerCard({ currentUser, student }: Props) {
  const [hrUsers, setHrUsers] = useState<HrUser[]>([]);

  useEffect(() => {
    if (currentUser.role !== "admin") return;

    let isActive = true;

    void listHrUsers()
      .then(({ items }) => {
        if (isActive) setHrUsers(items);
      })
      .catch(() => {
        // 负责人名称加载失败时仍显示固定的负责人 ID，页面其他内容不受影响。
      });

    return () => {
      isActive = false;
    };
  }, [currentUser.role]);

  const owner =
    currentUser.id === student.ownerHrId
      ? currentUser
      : hrUsers.find((hrUser) => hrUser.id === student.ownerHrId);

  return (
    <section className="overflow-hidden rounded-lg border border-[#cfdae4] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.05)]">
      <header className="border-b border-[#d5e0e9] px-5 py-4">
        <h2 className="font-semibold text-[#223548]">录入 HR</h2>
        <p className="mt-1 text-xs text-[#6b7f92]">
          该学生由以下 HR 账号录入。
        </p>
      </header>

      <div className="space-y-1 px-5 py-5">
        <p className="text-sm font-medium text-[#31485c]">
          {owner?.name ?? "未知 HR"}
        </p>
        <p className="text-xs text-[#6b7f92]">
          {owner?.email ?? student.ownerHrId ?? "未设置"}
        </p>
      </div>
    </section>
  );
}
