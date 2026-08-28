import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icon } from "@bb/shared-ui/icon";

export function AuthCallbackView() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status") === "error" ? "error" : "success";
  const content =
    status === "error"
      ? {
          title: t("views.authCallback.error.title"),
          message: t("views.authCallback.error.message"),
        }
      : {
          title: t("views.authCallback.success.title"),
          message: t("views.authCallback.success.message"),
        };

  return (
    <div className="flex justify-center bg-background px-4 pt-12">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          {status === "error" ? (
            <Icon name="CircleX" className="size-4 shrink-0 text-destructive" />
          ) : (
            <Icon name="CircleCheck" className="size-4 shrink-0" />
          )}
          <h1 className="text-sm font-semibold">{content.title}</h1>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{content.message}</p>
      </div>
    </div>
  );
}
