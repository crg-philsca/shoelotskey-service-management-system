"use client";

import { Toaster as Sonner } from "sonner";

import { cn } from "@/app/components/ui/utils";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className={cn("toaster group", props.className)}
      position="top-left"
      toastOptions={{
        style: {
          background: 'white',
          color: 'black',
          border: '1px solid #e5e7eb',
          fontSize: '14px',
          padding: '12px 16px',
        },
        className: 'custom-toast',
        duration: 4000,
      }}
      {...props}
    />
  );
};

export { Toaster };
