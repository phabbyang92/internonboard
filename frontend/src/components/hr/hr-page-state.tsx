interface HrPageStateProps {
  message: string;
  isError?: boolean;
}

export function HrPageState({
  message,
  isError = false,
}: HrPageStateProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#edf2f0] px-6">
      <p
        className={isError ? "text-sm text-[#9d3426]" : "text-sm text-[#52615d]"}
        role={isError ? "alert" : "status"}
      >
        {message}
      </p>
    </main>
  );
}
