"use client";

import { useEffect, type ReactNode } from "react";

interface HrModalProps {
  title: string;
  description?: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function HrModal({ title, description, isOpen, onClose, children, wide = false }: HrModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-6" onMouseDown={onClose}>
      <section
        className={`max-h-[92vh] w-full overflow-y-auto bg-white shadow-xl sm:rounded-lg sm:border sm:border-[#c8d6e1] ${wide ? "sm:max-w-6xl" : "sm:max-w-2xl"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hr-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-[#d5e0e9] bg-white px-5 py-4 sm:px-6">
          <div>
            <h2 id="hr-modal-title" className="text-lg font-semibold text-[#203448]">{title}</h2>
            {description ? <p className="mt-1 text-sm text-[#5f7285]">{description}</p> : null}
          </div>
          <button type="button" className="shrink-0 px-2 py-1 text-sm text-[#5f7285] hover:text-[#172735]" onClick={onClose}>
            关闭
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
