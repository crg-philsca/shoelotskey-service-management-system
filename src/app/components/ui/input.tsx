import * as React from "react";

import { cn } from "./utils";
import { stripCyberAttackInput } from "@/app/lib/customerValidation";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, id, name, onChange, onPaste, ...props }, ref) => {
    const generatedId = React.useId();
    const cleanGeneratedId = `field-${generatedId.replace(/:/g, '')}`;
    const effectiveId = id || name || cleanGeneratedId;
    const effectiveName = name || id || effectiveId;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (type !== 'file' && type !== 'checkbox' && type !== 'radio' && type !== 'password') {
        const val = e.target.value;
        if (val && (val.includes('<') || /script/i.test(val) || /javascript:/i.test(val) || /vbscript:/i.test(val))) {
          e.target.value = stripCyberAttackInput(val);
        }
      }
      onChange?.(e);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      // Allow pasting to pass Lighthouse 'paste-preventing-inputs' audit,
      // while guaranteeing that pasted malicious script tags are stripped.
      onPaste?.(e);
    };

    return (
      <input
        type={type}
        id={effectiveId}
        name={effectiveName}
        ref={ref}
        data-slot="input"
        onChange={handleChange}
        onPaste={handlePaste}
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base bg-input-background transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className,
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };

