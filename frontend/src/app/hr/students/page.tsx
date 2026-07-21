"use client";

import { HrPageState } from "@/components/hr/hr-page-state";
import { HrShell } from "@/components/hr/hr-shell";
import { HrStudentList } from "@/components/hr/hr-student-list";
import { useHrSession } from "@/hooks/use-hr-session";

export default function HrStudentsPage() {
  const { user, isLoading, errorMessage } = useHrSession();

  if (isLoading) {
    return <HrPageState message="正在确认 HR 登录状态..." />;
  }

  if (errorMessage) {
    return <HrPageState message={errorMessage} isError />;
  }

  if (!user) {
    return <HrPageState message="正在跳转到登录页..." />;
  }

  return (
    <HrShell user={user}>
      <HrStudentList />
    </HrShell>
  );
}
