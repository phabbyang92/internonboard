interface StudentPageStateProps {
  message: string;
  isError?: boolean;
}

export function StudentPageState({
  message,
  isError = false,
}: StudentPageStateProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f6f5] px-6">
      <p
        className={isError ? "text-sm text-[#9d3426]" : "text-sm text-[#52615d]"}
        role={isError ? "alert" : "status"}
      >
        {message}
      </p>
    </main>
  );
}
