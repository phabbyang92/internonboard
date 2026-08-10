"use client";

import { HrPageState } from "@/components/hr/hr-page-state";
import { HrSharedDocument } from "@/components/hr/hr-shared-document";
import { HrShell } from "@/components/hr/hr-shell";
import { useHrSession } from "@/hooks/use-hr-session";

export default function HrSharedDocumentPage() {
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
      <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <HrSharedDocument
          documentUrl={process.env.NEXT_PUBLIC_TENCENT_DOC_URL}
          documentTitle={process.env.NEXT_PUBLIC_TENCENT_DOC_TITLE}
        />
      </main>
    </HrShell>
  );
}
