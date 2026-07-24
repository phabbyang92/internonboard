"use client";

import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { AriaAttributes } from "react";

interface DatePickerChangeEvent {
  target: {
    value: string;
  };
}

interface DatePickerInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (event: DatePickerChangeEvent) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  "aria-describedby"?: string;
}

function parseDate(value?: string): Dayjs | undefined {
  if (!value) return undefined;

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : undefined;
}

export function DatePickerInput({
  id,
  name,
  value,
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  className = "",
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: DatePickerInputProps) {
  const minimumDate = parseDate(min);
  const maximumDate = parseDate(max);

  return (
    <>
      <DatePicker
        id={id}
        value={parseDate(value)}
        minDate={minimumDate}
        maxDate={maximumDate}
        disabled={disabled}
        format="YYYY/MM/DD"
        placeholder="年 / 月 / 日"
        allowClear={!required}
        inputReadOnly
        className={`app-date-picker w-full ${className}`}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        onChange={(date) =>
          onChange({
            target: { value: date ? date.format("YYYY-MM-DD") : "" },
          })
        }
      />
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </>
  );
}
