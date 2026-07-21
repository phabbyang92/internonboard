import type { ReactNode } from "react";

interface FormFieldProps {
  htmlFor: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  htmlFor,
  label,
  required = false,
  hint,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-semibold text-[#263746]"
      >
        {label}
        {required ? (
          <span className="ml-1 text-[#b44532]" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? <p className="mt-2 text-xs text-[#6b7f92]">{hint}</p> : null}
    </div>
  );
}
