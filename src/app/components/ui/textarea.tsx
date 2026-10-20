import * as React from "react";

import { cn } from "./utils";
import { stripCyberAttackInput } from "@/app/lib/customerValidation";

function Textarea({ className, id, name, onChange, onPaste, ...props }: React.ComponentProps<"textarea">) {
  const generatedId = React.useId();
  const cleanGeneratedId = `field-${generatedId.replace(/:/g, '')}`;
  const effectiveId = id || name || cleanGeneratedId;
  const effectiveName = name || id || effectiveId;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val && (val.includes('<') || /script/i.test(val) || /javascript:/i.test(val) || /vbscript:/i.test(val))) {
      e.target.value = stripCyberAttackInput(val);
    }
    onChange?.(e);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    onPaste?.(e);
  };

  return (
    <textarea
      id={effectiveId}
      name={effectiveName}
      data-slot="textarea"
      onChange={handleChange}
      onPaste={handlePaste}
      className={cn(
        "resize-none border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-input-background px-3 py-2 text-base transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
