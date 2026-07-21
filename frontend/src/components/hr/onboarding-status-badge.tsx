import type { OnboardingStatus } from "@/types/student";

const statusConfig: Record<
  OnboardingStatus,
  { label: string; className: string }
> = {
  candidate: {
    label: "候选学生",
    className: "border-[#c8d4df] bg-[#f2f5f8] text-[#52677a]",
  },
  pending_onboarding: {
    label: "待入职",
    className: "border-[#e7bd97] bg-[#fff6ed] text-[#965125]",
  },
  onboarded: {
    label: "已入职",
    className: "border-[#9cc8ba] bg-[#eef8f4] text-[#176555]",
  },
};

export function OnboardingStatusBadge({
  status,
}: {
  status: OnboardingStatus;
}) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}
