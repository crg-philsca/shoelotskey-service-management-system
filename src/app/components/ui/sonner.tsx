"use client";

import { Toaster as Sonner } from "sonner";

import { cn } from "@/app/components/ui/utils";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className={cn("toaster group z-[99999]", props.className)}
      position={props.position || "top-center"}
      style={{ '--width': 'max-content', ...props.style } as React.CSSProperties}
      toastOptions={{
        style: {
          background: 'white',
          color: 'black',
          border: '1px solid #e5e7eb',
          fontSize: '13px',
          padding: '12px 22px',
          ...props.toastOptions?.style,
        },
        className: cn('custom-toast rounded-xl shadow-xl', props.toastOptions?.className),
        duration: 4000,
        ...props.toastOptions,
      }}
      {...props}
    />
  );
};

export { Toaster };
