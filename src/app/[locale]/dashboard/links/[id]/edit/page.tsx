"use client";

import { useEffect, useState } from "react";

import { CircleNotch, LinkSimple } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { getLink } from "@/app/actions/links";
import type { ShortLink } from "@/lib/links/types";
import { useWorkspace } from "@/contexts/workspace-context";

import ShortLinkForm from "../../ShortLinkForm";

export default function EditLinkPage() {
  const t = useTranslations("links");
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id ?? "");
  const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace();

  const [link, setLink] = useState<ShortLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceLoading || !currentWorkspace?.id || !id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { link: fetched, error: fetchError } = await getLink(id);
      if (cancelled) return;
      if (fetchError) setError(fetchError);
      else setLink(fetched ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, currentWorkspace?.id, workspaceLoading]);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto w-full max-w-3xl space-y-6"
    >
      <DashboardPageHeader
        icon={<LinkSimple className="h-4 w-4" weight="bold" />}
        badge={t("header.badge")}
        title={t("edit.title")}
        description={t("edit.description")}
        back={{ onClick: () => router.push("/dashboard/links"), label: t("edit.back") }}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
        </div>
      ) : error || !link ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {error ?? t("edit.notFound")}
        </p>
      ) : (
        <ShortLinkForm mode="edit" initialData={link} />
      )}
    </motion.main>
  );
}
