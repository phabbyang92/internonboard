"use client";

import { useParams } from "next/navigation";

import { HrPageState } from "@/components/hr/hr-page-state";
import { HrShell } from "@/components/hr/hr-shell";
import { HrStudentDetail } from "@/components/hr/hr-student-detail";
import { useHrSession } from "@/hooks/use-hr-session";

export default function HrStudentDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, isLoading, errorMessage } = useHrSession();

  if (isLoading) return <HrPageState message="正在确认 HR 登录状态..." />;
  if (errorMessage) return <HrPageState message={errorMessage} isError />;
  if (!user) return <HrPageState message="正在跳转到登录页..." />;

  return (
    <HrShell user={user}>
      <HrStudentDetail studentId={params.id} />
    </HrShell>
  );
}
