"use client";

import { useMemo } from "react";

import { SelectInput } from "@/components/ui/select-input";

interface YearSelectInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function YearSelectInput({
  id,
  value,
  onChange,
  minYear = new Date().getFullYear() - 40,
  maxYear = new Date().getFullYear() + 10,
  disabled = false,
  className = "",
  ariaLabel,
}: YearSelectInputProps) {
  const options = useMemo(() => {
    const firstYear = Math.min(minYear, maxYear);
    const lastYear = Math.max(minYear, maxYear);

    return Array.from(
      { length: lastYear - firstYear + 1 },
      (_, index) => lastYear - index,
    ).map((year) => ({
      value: String(year),
      label: String(year),
    }));
  }, [maxYear, minYear]);

  return (
    <SelectInput
      id={id}
      value={value || undefined}
      options={options}
      onChange={onChange}
      placeholder="请选择年份"
      disabled={disabled}
      className={className}
      ariaLabel={ariaLabel}
      showSearch
    />
  );
}
