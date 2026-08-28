import { cn } from "@bb/shared-ui/lib/utils";
import vozenLogoUrl from "../../../assets/vozen-logo.svg";

/**
 * vozen's own mark, for rows where it is one listed thing among others —
 * beside a provider's logo in Updates, or beside a provider's skills in the
 * tools list. Decorative in every one of those places: the row already
 * names it.
 */
export function VozenLogo({ className = "size-4" }: { className?: string }) {
  return (
    <img
      src={vozenLogoUrl}
      alt=""
      aria-hidden="true"
      className={cn(className, "object-contain dark:invert")}
    />
  );
}
