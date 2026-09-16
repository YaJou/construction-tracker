"use client";

import { cn } from "@/utils/cn";
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Option = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

function parseOptions(children: ReactNode): Option[] {
  const options: Option[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as {
      value?: string | number;
      disabled?: boolean;
      children?: ReactNode;
    };
    if (props.value === undefined && child.type !== "option") return;
    options.push({
      value: String(props.value ?? ""),
      label: props.children,
      disabled: Boolean(props.disabled),
    });
  });
  return options;
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  className?: string;
};

export function Select({
  className,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  id,
  name,
  "aria-label": ariaLabel,
  onBlur,
  onFocus,
}: SelectProps) {
  const options = useMemo(() => parseOptions(children), [children]);
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(
    String(value ?? defaultValue ?? options[0]?.value ?? "")
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  const isControlled = value !== undefined;
  const currentValue = isControlled ? String(value) : internalValue;
  const selected = options.find((o) => o.value === currentValue) ?? options[0];
  const selectedLabel = selected?.label ?? "";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const idx = Math.max(
      0,
      options.findIndex((o) => o.value === currentValue)
    );
    setActiveIndex(idx);
  }, [open, currentValue, options]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    const place = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      const maxH = 240;
      const gap = 6;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const openUp = spaceBelow < Math.min(maxH, 160) && spaceAbove > spaceBelow;
      const height = Math.min(maxH, openUp ? spaceAbove : spaceBelow);
      const width = Math.max(rect.width, 160);

      setMenuStyle({
        position: "fixed",
        left: Math.min(rect.left, window.innerWidth - width - 8),
        width,
        maxHeight: Math.max(120, height),
        zIndex: 80,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
      });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commit = (next: string) => {
    if (!isControlled) setInternalValue(next);
    onChange?.({
      target: { value: next, name: name ?? "" },
      currentTarget: { value: next, name: name ?? "" },
    } as React.ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const moveActive = (dir: 1 | -1) => {
    if (!options.length) return;
    let i = activeIndex;
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i]?.disabled) {
        setActiveIndex(i);
        return;
      }
    }
  };

  const listbox =
    open && mounted
      ? createPortal(
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            tabIndex={-1}
            style={menuStyle}
            className={cn(
              "overflow-auto rounded-[12px] border border-line bg-white py-1.5",
              "shadow-[0_12px_32px_rgba(23,63,52,0.12)]"
            )}
          >
            {options.map((opt, index) => {
              const isSelected = opt.value === currentValue;
              const isActive = index === activeIndex;
              return (
                <li
                  key={`${opt.value}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled || undefined}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (opt.disabled) return;
                    commit(opt.value);
                  }}
                  className={cn(
                    "mx-1.5 flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-[8px] px-3 text-sm transition-colors duration-fast motion-reduce:transition-none",
                    opt.disabled && "cursor-not-allowed opacity-40",
                    isSelected && "bg-green text-white",
                    !isSelected && isActive && "bg-surface text-ink",
                    !isSelected && !isActive && "text-ink hover:bg-surface"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected ? (
                    <Check className="h-4 w-4 shrink-0 text-orange" aria-hidden />
                  ) : null}
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={currentValue} /> : null}
      <button
        ref={buttonRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onFocus={onFocus as unknown as React.FocusEventHandler<HTMLButtonElement>}
        onBlur={onBlur as unknown as React.FocusEventHandler<HTMLButtonElement>}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!open) setOpen(true);
            else if (e.key === "Enter" || e.key === " ") {
              const opt = options[activeIndex];
              if (opt && !opt.disabled) commit(opt.value);
            } else moveActive(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) setOpen(true);
            else moveActive(-1);
          } else if (e.key === "Home") {
            e.preventDefault();
            setActiveIndex(0);
          } else if (e.key === "End") {
            e.preventDefault();
            setActiveIndex(options.length - 1);
          }
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-[10px] border border-line bg-white px-3 py-2.5 text-left text-sm text-ink",
          "touch-target transition-colors duration-fast",
          "hover:border-[#D5DED9]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/30 focus-visible:border-transparent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-green/40 ring-2 ring-orange/20"
        )}
      >
        <span className={cn("truncate", !selected?.value && "text-muted")}>
          {selectedLabel}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform duration-fast motion-reduce:transition-none",
            open && "rotate-180 text-green"
          )}
          aria-hidden
        />
      </button>
      {listbox}
    </div>
  );
}

Select.displayName = "Select";
