"use client";

import { Select } from "antd";

export interface SelectInputOption<Value extends string | number = string> {
  value: Value;
  label: string;
  disabled?: boolean;
}

interface SelectInputProps<Value extends string | number = string> {
  id?: string;
  value: Value | undefined;
  options: SelectInputOption<Value>[];
  onChange: (value: Value) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  showSearch?: boolean;
}

export function SelectInput<Value extends string | number = string>({
  id,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  className = "",
  ariaLabel,
  showSearch = false,
}: SelectInputProps<Value>) {
  return (
    <Select
      id={id}
      value={value}
      options={options}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`app-select w-full ${className}`}
      popupMatchSelectWidth={false}
      showSearch={showSearch}
      optionFilterProp="label"
      aria-label={ariaLabel}
    />
  );
}
