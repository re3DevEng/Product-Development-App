"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
export function SelectionButtons({
  label,
  value,
  options,
  onChange,
  compact = false,
  disabledOptions = [],
}: {
  label: string;
  value: string;
  options: readonly (string | { value: string; label: string })[];
  onChange: (value: string) => void;
  compact?: boolean;
  disabledOptions?: readonly string[];
}) {
  const name = useId();
  return (
    <fieldset
      className={`selection-field ${compact ? "selection-compact" : ""}`}
    >
      <legend>{label}</legend>
      <div className="selection-buttons">
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { value: option, label: option }
              : option;
          const disabled = disabledOptions.includes(item.value);
          return (
            <label
              className={`${value === item.value ? "selected" : ""} ${disabled ? "disabled" : ""}`}
              key={item.value}
            >
              <input
                type="radio"
                name={name}
                value={item.value}
                checked={value === item.value}
                disabled={disabled}
                onChange={() => onChange(item.value)}
              />
              <span>{item.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

let openModalCount = 0;
let originalBodyOverflow = "";
export function Modal({
  children,
  onClose,
  label,
  wide = false,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    if (openModalCount === 0)
      originalBodyOverflow = document.body.style.overflow;
    openModalCount += 1;
    document.body.style.overflow = "hidden";
    return () => {
      d?.close();
      openModalCount -= 1;
      if (openModalCount === 0)
        document.body.style.overflow = originalBodyOverflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={`dialog ${wide ? "drawer" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const box = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      {children}
    </dialog>
  );
}
