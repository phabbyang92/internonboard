"use client";

import { DayPicker, type Matcher } from "@daypicker/react";
import { zhCN } from "@daypicker/react/locale";
import { CalendarDays } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useEffect,
  useRef,
  useState,
  type AriaAttributes,
} from "react";

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

interface PopoverPosition {
  left: number;
  top: number;
}

function parseInputDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(value: string): string {
  const date = parseInputDate(value);
  if (!date) return "年 / 月 / 日";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] =
    useState<PopoverPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectedDate = parseInputDate(value);
  const minimumDate = parseInputDate(min);
  const maximumDate = parseInputDate(max);
  const currentYear = new Date().getFullYear();
  const startMonth = minimumDate ?? new Date(currentYear - 100, 0, 1);
  const endMonth = maximumDate ?? new Date(currentYear + 20, 11, 31);
  const defaultMonth = selectedDate ?? minimumDate ?? new Date();
  const disabledMatchers: Matcher[] = [];

  if (minimumDate) disabledMatchers.push({ before: minimumDate });
  if (maximumDate) disabledMatchers.push({ after: maximumDate });

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target as Node;

      if (
        !containerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function updatePopoverPosition() {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const viewportPadding = 16;
      const gap = 8;
      const availableBelow = window.innerHeight - triggerRect.bottom;
      const availableAbove = triggerRect.top;
      const shouldOpenAbove =
        availableBelow < popoverRect.height + gap &&
        availableAbove > availableBelow;

      const preferredTop = shouldOpenAbove
        ? triggerRect.top - popoverRect.height - gap
        : triggerRect.bottom + gap;
      const maximumTop = window.innerHeight - popoverRect.height - viewportPadding;
      const maximumLeft = window.innerWidth - popoverRect.width - viewportPadding;

      setPopoverPosition({
        top: Math.max(viewportPadding, Math.min(preferredTop, maximumTop)),
        left: Math.max(
          viewportPadding,
          Math.min(triggerRect.left, maximumLeft),
        ),
      });
    }

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);

    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-describedby={ariaDescribedBy}
        data-required={required || undefined}
        data-invalid={ariaInvalid || undefined}
        disabled={disabled}
        className={`${className} flex items-center justify-between gap-3 text-left`}
        onClick={() => {
          if (!isOpen) setPopoverPosition(null);
          setIsOpen((current) => !current);
        }}
      >
        <span className={value ? "text-[#172735]" : "text-[#6b7f92]"}>
          {displayDate(value)}
        </span>
        <CalendarDays aria-hidden="true" className="h-5 w-5 shrink-0 text-[#52677a]" />
      </button>

      {name ? <input type="hidden" name={name} value={value} /> : null}

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              className="intern-date-picker fixed z-[100] w-max max-w-[calc(100vw-2rem)] rounded-lg border border-[#b9c9d7] bg-white p-3 text-[#172735] shadow-xl"
              role="dialog"
              aria-label="选择日期"
              style={{
                left: popoverPosition?.left ?? 0,
                top: popoverPosition?.top ?? 0,
                visibility: popoverPosition ? "visible" : "hidden",
              }}
            >
              <DayPicker
                mode="single"
                locale={zhCN}
                selected={selectedDate}
                defaultMonth={defaultMonth}
                startMonth={startMonth}
                endMonth={endMonth}
                disabled={disabledMatchers}
                captionLayout="dropdown"
                navLayout="after"
                reverseYears
                showOutsideDays
                onSelect={(date) => {
                  if (!date) return;
                  onChange({ target: { value: toInputDate(date) } });
                  setIsOpen(false);
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
