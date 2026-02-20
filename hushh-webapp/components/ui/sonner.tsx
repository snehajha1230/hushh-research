"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster({ ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      closeButton
      className="toaster group !z-[9999]"
      style={{ marginTop: "max(env(safe-area-inset-top), 4rem)" }}
      toastOptions={{
        classNames: {
          toast: "group toast morphy-sonner-toast",
          title: "morphy-sonner-title",
          description: "morphy-sonner-description",
          actionButton:
            "morphy-sonner-action",
          cancelButton:
            "morphy-sonner-cancel",
          closeButton:
            "morphy-sonner-close",
        },
      }}
      {...props}
    />
  );
}
