"use client";

import { Select } from "antd";
import type { RefSelectProps } from "antd";
import { useRef } from "react";
import type { ReactNode } from "react";

export interface SelectInputOption<Value extends string | number = string> {
  value: Value;
  label: ReactNode;
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
  initialScrollIndex?: number;
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
  initialScrollIndex,
}: SelectInputProps<Value>) {
  const selectRef = useRef<RefSelectProps>(null);

  function handleOpenChange(open: boolean) {
    if (!open || initialScrollIndex === undefined) {
      return;
    }

    // 下拉面板挂载后，再把指定选项滚动到可视区域中央附近。
    requestAnimationFrame(() => {
      selectRef.current?.scrollTo({
        index: initialScrollIndex,
        align: "top",
      });
    });
  }

  return (
    <Select
      ref={selectRef}
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
      onOpenChange={handleOpenChange}
    />
  );
}
