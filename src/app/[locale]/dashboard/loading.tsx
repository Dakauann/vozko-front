import { Loader } from "@/components/elevated-design/loader";
import { useTranslations } from "next-intl";

export default function DashboardLoading() {
  const t = useTranslations("dashboard");

  return (
    <div className="flex items-center justify-center min-h-[400px] w-full">
      <Loader size="lg" variant="gradient" message={t("loadingMessage")} />
    </div>
  );
}
