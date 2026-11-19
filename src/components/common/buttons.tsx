import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-field px-4 text-[14px] font-bold whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-primary/30 disabled:cursor-not-allowed aria-disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0";

export const primaryButtonClass = cn(
  base,
  "bg-primary text-white hover:bg-primary/90 disabled:bg-border-strong disabled:text-ink-2 aria-disabled:bg-border-strong aria-disabled:text-ink-2",
);
export const secondaryButtonClass = cn(
  base,
  "border border-border-strong bg-surface text-ink hover:bg-background disabled:text-muted-foreground",
);
export const dangerButtonClass = cn(base, "border border-border-strong bg-surface text-help-strong hover:bg-help-bg");
export const dashedButtonClass = cn(
  base,
  "border border-dashed border-border-strong bg-transparent font-medium text-ink-2 hover:bg-surface",
);

export function PrimaryButton({ className, ...props }: ComponentProps<"button">) {
  return <button className={cn(primaryButtonClass, className)} {...props} />;
}

export function SecondaryButton({ className, ...props }: ComponentProps<"button">) {
  return <button type="button" className={cn(secondaryButtonClass, className)} {...props} />;
}

export function PrimaryLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn(primaryButtonClass, className)} {...props} />;
}

export function SecondaryLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn(secondaryButtonClass, className)} {...props} />;
}

export function DashedAddLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn(dashedButtonClass, className)} {...props} />;
}
