"use client";

import { Toaster as Sonner } from "sonner";

import { cn } from "@/app/components/ui/utils";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className={cn("toaster group z-[9999]", props.className)}
      position={props.position || "top-center"}
      toastOptions={{
        style: {
          background: 'white',
          color: 'black',
          border: '1px solid #e5e7eb',
          fontSize: '13px',
          padding: '12px 16px',
          maxWidth: 'calc(100vw - 24px)',
        },
        className: 'custom-toast max-w-[calc(100vw-24px)] mx-auto rounded-xl shadow-xl',
        duration: 4000,
        ...props.toastOptions,
      }}
      {...props}
    />
  );
};

export { Toaster };
