"use client";

import {
  BRANCH_CODECS,
  type Branch,
  type BranchCodecID,
  type BranchSecretResult,
} from "@/lib/branches/types";
import { CircleNotch, DeviceMobileCamera, FloppyDisk, Headset, IdentificationCard, Plus } from "@phosphor-icons/react";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { createBranchAction, updateBranchAction } from "@/app/actions/branches";
import { useEffect, useMemo, useState, useTransition } from "react";

import BranchSecretDialog from "./BranchSecretDialog";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { buildBranchUpdatePayload } from "@/lib/branches/build-update-payload";
import { cn } from "@/lib/utils";
import { listMembersAction } from "@/app/actions/workspace";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
};

const SIP_USER_RE = /^[a-zA-Z0-9._-]+$/;

// Backend error codes (branch_handler.go) that have a dedicated localized message
// under branchesPage.errors. Anything outside this set falls back to the raw
// server message, then a generic string, so the operator always learns what failed.
const KNOWN_BRANCH_ERROR_CODES = new Set([
  "branch_limit_reached",
  "branch_sip_user_taken",
  "branch_sip_user_invalid",
  "branch_member_required",
  "branch_member_not_found",
  "branch_forbidden",
  "branch_max_contacts_invalid",
  "branch_invalid",
]);

interface MemberOption {
  userId: string;
  label: string;
}

interface BranchFormProps {
  mode: "create" | "edit";
  branch?: Branch;
}

export default function BranchForm({ mode, branch }: BranchFormProps) {
  const t = useTranslations("branchesPage.form");
  const tPage = useTranslations("branchesPage");
  const tToast = useTranslations("branchesPage.toast");
  const tErr = useTranslations("branchesPage.errors");
  const router = useRouter();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  // Turn a backend (code, message) pair into the clearest localized string we can:
  // a dedicated translation when the code is known, else the server message, else
  // a generic fallback. Never leaves the operator without an explanation.
  const resolveBranchError = (code?: string | null, message?: string | null) => {
    if (code && KNOWN_BRANCH_ERROR_CODES.has(code)) return tErr(code);
    if (message && message.trim()) return message;
    return tErr("generic");
  };

  const [members, setMembers] = useState<MemberOption[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [userId, setUserId] = useState(branch?.userId ?? "");
  const [sipUser, setSipUser] = useState(branch?.sipUser ?? "");
  const [displayName, setDisplayName] = useState(branch?.displayName ?? "");
  const [maxContacts, setMaxContacts] = useState(branch?.maxContacts ?? 2);
  const [dnd, setDnd] = useState(branch?.dnd ?? false);
  const [codecs, setCodecs] = useState<BranchCodecID[]>(branch?.codecs ?? ["pcma", "pcmu"]);
  const [errors, setErrors] = useState<{ sipUser?: string; member?: string }>({});
  const [secret, setSecret] = useState<BranchSecretResult | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    if (mode !== "create" || !workspaceId) return;
    let active = true;
    void (async () => {
      const { members: rows } = await listMembersAction(workspaceId);
      if (!active) return;
      setMembers(rows.map((m) => ({ userId: m.userId, label: m.username || m.email || m.userId })));
      setMembersLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [mode, workspaceId]);

  const noMembers = mode === "create" && membersLoaded && members.length === 0;

  const memberLabel = useMemo(() => members.find((m) => m.userId === userId)?.label, [members, userId]);

  const toggleCodec = (id: BranchCodecID) =>
    setCodecs((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const validate = () => {
    const next: { sipUser?: string; member?: string } = {};
    if (mode === "create") {
      if (!userId) next.member = t("errMember");
      if (!sipUser.trim() || !SIP_USER_RE.test(sipUser.trim())) next.sipUser = t("errSipUser");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    if (!validate()) {
      toast({ title: t("validationFailed"), description: t("validationFailedHint"), variant: "destructive" });
      return;
    }
    startSaving(async () => {
      if (mode === "create") {
        const { result, error, code } = await createBranchAction({
          userId,
          sipUser: sipUser.trim(),
          displayName: displayName.trim() || undefined,
          codecs,
          maxContacts,
          dnd,
        });
        if (error || !result) {
          toast({ title: tToast("genericError"), description: resolveBranchError(code, error), variant: "destructive" });
          return;
        }
        setSecret(result);
      } else if (branch) {
        const payload = buildBranchUpdatePayload(branch, { displayName: displayName.trim(), codecs, maxContacts, dnd });
        const { error, code } = await updateBranchAction(branch.id, payload);
        if (error) {
          toast({ title: tToast("genericError"), description: resolveBranchError(code, error), variant: "destructive" });
          return;
        }
        toast({ title: tToast("updated") });
        router.push(`/dashboard/branches/${branch.id}`);
      }
    });
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-6">
      <motion.div variants={itemVariants}>
        <DashboardPageHeader
          back={{ onClick: () => router.push("/dashboard/branches"), label: tPage("badge") }}
          icon={<Headset className="h-5 w-5" weight="fill" />}
          badge={tPage("badge")}
          title={mode === "create" ? t("createTitle") : `${t("editTitle")} · ${branch?.sipUser ?? ""}`}
          description=""
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="rounded-[20px] border border-border bg-card p-6" style={{ boxShadow: softSurfaceShadow }}>
          <SectionHeader icon={<IdentificationCard className="h-5 w-5" weight="fill" />} title={t("member")} subtitle={t("sipUser")} />

          {mode === "create" && (
            <Field label={t("member")} required error={errors.member} className="mb-4">
              {noMembers ? (
                <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <p className="font-medium">{t("noMembers")}</p>
                  <p className="mt-0.5 text-xs opacity-90">{t("noMembersHint")}</p>
                </div>
              ) : (
                <ElevatedSelect value={userId} onValueChange={setUserId} placeholder={t("memberPlaceholder")}>
                  {members.map((m) => (
                    <ElevatedSelectItem key={m.userId} value={m.userId}>
                      {m.label}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>
              )}
            </Field>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("sipUser")} required hint={mode === "create" ? t("sipUserHint") : undefined} error={errors.sipUser}>
              {mode === "create" ? (
                <ElevatedInput value={sipUser} onChange={(e) => setSipUser(e.target.value)} placeholder="1001" />
              ) : (
                <p className="rounded-xl border border-border bg-muted/40 px-4 py-2.5 font-mono text-sm text-foreground">
                  {branch?.sipUser}
                  {memberLabel ? <span className="ml-2 font-sans text-muted-foreground">· {memberLabel}</span> : null}
                </p>
              )}
            </Field>
            <Field label={t("displayName")}>
              <ElevatedInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("displayNamePlaceholder")} />
            </Field>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="rounded-[20px] border border-border bg-card p-6" style={{ boxShadow: softSurfaceShadow }}>
          <SectionHeader icon={<DeviceMobileCamera className="h-5 w-5" weight="fill" />} title={t("codecs")} subtitle={t("maxContacts")} />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("maxContacts")}>
              <ElevatedInput type="number" min={1} max={8} value={String(maxContacts)} onChange={(e) => setMaxContacts(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} />
            </Field>
            <ToggleRow label={t("dnd")} hint={t("dndHint")} checked={dnd} onChange={setDnd} />
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-foreground">{t("codecs")}</label>
            <div className="flex flex-wrap gap-2">
              {BRANCH_CODECS.map((c) => {
                const active = codecs.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCodec(c.id)}
                    className={cn(
                      "rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
                      active ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {c.label}
                    {c.recommended ? <span className="ml-2 text-[10px] font-semibold uppercase text-primary/70">★</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="flex items-center justify-end gap-2">
        <Button variant="outline" title={t("cancel")} onClick={() => router.back()} disabled={saving} />
        <Button
          variant="action"
          title={mode === "create" ? t("create") : t("save")}
          onClick={submit}
          disabled={saving || noMembers}
          icon={saving ? <CircleNotch weight="bold" className="h-4 w-4 animate-spin" /> : mode === "create" ? <Plus weight="bold" className="h-4 w-4" /> : <FloppyDisk weight="bold" className="h-4 w-4" />}
          iconVisible
          iconSide="left"
        />
      </motion.div>

      <BranchSecretDialog
        result={secret}
        onClose={() => {
          setSecret(null);
          router.push("/dashboard/branches");
        }}
      />
    </motion.div>
  );
}

function Field({ label, hint, required, error, children, className }: { label: string; hint?: string; required?: boolean; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow-lg">{icon}</div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
      <div className="pr-4">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <ElevatedSwitch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

