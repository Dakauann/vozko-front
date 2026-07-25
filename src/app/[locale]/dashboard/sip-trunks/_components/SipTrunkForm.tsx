"use client";

import type {
  AdvancedTrunkConfig,
  CodecID,
  CreateSipTrunkPayload,
  NumberFormat,
  PublicAddressMode,
  SRTPMode,
  SessionRefresher,
  SipTrunk,
  SupportedCodec,
  TransportType,
  TrunkType,
} from "@/lib/sip-trunks/types";
import {
  ArrowDown,
  ArrowUp,
  CircleNotch,
  Equalizer,
  Gear,
  Globe,
  Info,
  ListNumbers,
  Plugs,
  ShieldCheck,
  WifiHigh,
} from "@phosphor-icons/react";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createSipTrunkAction,
  getSupportedCodecsAction,
  updateSipTrunkAction,
} from "@/app/actions/sip-trunks";
import { useEffect, useMemo, useState, useTransition } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { getBrand } from "@/config/brand";
import { buildSipTrunkUpdatePayload } from "@/lib/sip-trunks/build-update-payload";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";


// Resilience fallback only, the real catalog is fetched from the backend
// (GET /sip-trunks/codecs) so the picker always reflects what the media plane
// can actually negotiate. Kept in sync with the backend's default profile so a
// failed fetch still shows correct, offerable codecs (never the removed
// G.722/Opus). See vozko-go docs/SIP_AUDIO_PIPELINE.md §9.1.
const FALLBACK_CODECS: SupportedCodec[] = [
  {
    id: "pcma",
    label: "G.711 A-law (PCMA)",
    description: "Narrowband padrão. Recomendado no Brasil (PSTN A-law nativo).",
    recommended: true,
    default: true,
  },
  {
    id: "pcmu",
    label: "G.711 µ-law (PCMU)",
    description: "Narrowband padrão, América do Norte/Japão.",
    default: true,
  },
];

function hasAdvancedValues(adv: AdvancedTrunkConfig): boolean {
  return Object.values(adv).some((v) => {
    if (v === undefined || v === null) return false;
    if (typeof v === "string") return v.trim() !== "";
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });
}

function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : undefined;
}


interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

function Field({
  label,
  hint,
  required,
  error,
  children,
  className,
}: FieldProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({ label, hint, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
      <div className="pr-4">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 cursor-pointer accent-primary"
      />
    </div>
  );
}

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

function SectionHeader({ icon, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow-lg">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}


const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

interface SipTrunkFormProps {
  trunk?: SipTrunk;
  mode: "create" | "edit";
}

export default function SipTrunkForm({ trunk, mode }: SipTrunkFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations("sipTrunksPage.form");
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("general");

  const [name, setName] = useState(trunk?.name ?? "");
  const [description, setDescription] = useState(trunk?.description ?? "");
  const [host, setHost] = useState(trunk?.host ?? "");
  const [port, setPort] = useState(trunk?.port?.toString() ?? "5060");
  const [username, setUsername] = useState(trunk?.username ?? "");
  const [password, setPassword] = useState("");
  const [domain, setDomain] = useState(trunk?.domain ?? "");
  const [transport, setTransport] = useState<TransportType>(
    trunk?.transport ?? "udp",
  );
  const [trunkType, setTrunkType] = useState<TrunkType>(
    trunk?.trunkType ?? "mobile",
  );
  const [isRotational, setIsRotational] = useState(
    trunk?.isRotational ?? false,
  );
  const [phoneNumber, setPhoneNumber] = useState(trunk?.phoneNumber ?? "");

  const [advanced, setAdvanced] = useState<AdvancedTrunkConfig>(
    trunk?.advanced ?? {},
  );
  const setAdv = <K extends keyof AdvancedTrunkConfig>(
    key: K,
    value: AdvancedTrunkConfig[K],
  ) => setAdvanced((prev) => ({ ...prev, [key]: value }));

  // Codecs are fetched live from the backend so the picker only ever offers
  // what the media plane can actually negotiate. FALLBACK_CODECS keeps the form
  // usable if the request fails.
  const [codecCatalog, setCodecCatalog] =
    useState<SupportedCodec[]>(FALLBACK_CODECS);

  useEffect(() => {
    let active = true;
    getSupportedCodecsAction().then(({ codecs }) => {
      if (active && codecs.length > 0) setCodecCatalog(codecs);
    });
    return () => {
      active = false;
    };
  }, []);

  const defaultCodecSummary = useMemo(
    () =>
      codecCatalog
        .filter((c) => c.default)
        .map((c) => c.label)
        .join(" → "),
    [codecCatalog],
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): { ok: boolean; firstTab?: string } => {
    const e: Record<string, string> = {};
    let firstTab: string | undefined;

    if (!name.trim()) {
      e.name = "Nome é obrigatório";
      firstTab = firstTab ?? "general";
    }
    if (!isRotational && !phoneNumber.trim()) {
      e.phoneNumber = "Número é obrigatório para troncos não-rotacionais";
      firstTab = firstTab ?? "general";
    }
    if (!host.trim()) {
      e.host = "Host é obrigatório";
      firstTab = firstTab ?? "connection";
    }
    if (!username.trim()) {
      e.username = "Usuário é obrigatório";
      firstTab = firstTab ?? "connection";
    }
    if (mode === "create" && !password.trim()) {
      e.password = "Senha é obrigatória";
      firstTab = firstTab ?? "connection";
    }
    const portNum = parseInt(port, 10);
    if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
      e.port = "Porta inválida (1-65535)";
      firstTab = firstTab ?? "connection";
    }

    setErrors(e);
    return { ok: Object.keys(e).length === 0, firstTab };
  };

  const handleSubmit = () => {
    const result = validate();
    if (!result.ok) {
      if (result.firstTab) setActiveTab(result.firstTab);
      return;
    }

    startTransition(async () => {
      if (mode === "create") {
        const payload: CreateSipTrunkPayload = {
          name: name.trim(),
          description: description.trim() || undefined,
          host: host.trim(),
          port: parseInt(port, 10),
          username: username.trim(),
          password: password.trim(),
          domain: domain.trim() || undefined,
          transport,
          trunkType,
          isRotational,
          phoneNumber: !isRotational ? phoneNumber.trim() : undefined,
          advanced: hasAdvancedValues(advanced) ? advanced : undefined,
        };

        const { trunk: newTrunk, error } = await createSipTrunkAction(payload);
        if (error) {
          toast({
            title: t("error"),
            description: error,
            variant: "destructive",
          });
        } else if (newTrunk) {
          toast({
            title: "Tronco SIP criado",
            description: `${newTrunk.name} foi criado com sucesso`,
          });
          router.push(`/dashboard/sip-trunks/${newTrunk.id}`);
        }
        return;
      }

      if (!trunk) return;

      const payload = buildSipTrunkUpdatePayload(trunk, {
        name: name.trim(),
        description: description.trim() || undefined,
        host: host.trim(),
        port: parseInt(port, 10),
        username: username.trim(),
        password: password.trim() || undefined,
        domain: domain.trim() || undefined,
        transport,
        trunkType,
        isRotational,
        phoneNumber: !isRotational ? phoneNumber.trim() : undefined,
        advanced,
      });

      if (Object.keys(payload).length === 0) {
        toast({ title: "Sem alterações", description: t("noChanges") });
        return;
      }

      const { trunk: updatedTrunk, error } = await updateSipTrunkAction(
        trunk.id,
        payload,
      );
      if (error) {
        toast({
          title: t("error"),
          description: error,
          variant: "destructive",
        });
      } else if (updatedTrunk) {
        toast({
          title: "Tronco SIP atualizado",
          description: `${updatedTrunk.name} foi atualizado com sucesso`,
        });
        router.push(`/dashboard/sip-trunks/${updatedTrunk.id}`);
      }
    });
  };


  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <DashboardPageHeader
          back={{
            onClick: () => router.push("/dashboard/sip-trunks"),
            label: "Tronco SIP",
          }}
          icon={<Plugs className="h-5 w-5" weight="fill" />}
          badge="Tronco SIP"
          title={
            mode === "create"
              ? "Novo Tronco SIP"
              : `Editar ${trunk?.name ?? ""}`
          }
          description=""
        />
      </motion.div>

      {/* Single card with all tabs */}
      <motion.div variants={itemVariants}>
        <div
          className="rounded-[26px] border border-border/70 bg-card/90 p-6"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto gap-1 p-1">
              <TabsTrigger
                value="general"
                className="flex items-center gap-2 py-2"
              >
                <Info weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">Geral</span>
              </TabsTrigger>
              <TabsTrigger
                value="connection"
                className="flex items-center gap-2 py-2"
              >
                <Globe weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">Conexão</span>
              </TabsTrigger>
              <TabsTrigger
                value="registration"
                className="flex items-center gap-2 py-2"
              >
                <ShieldCheck weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">Registro</span>
              </TabsTrigger>
              <TabsTrigger
                value="media"
                className="flex items-center gap-2 py-2"
              >
                <Equalizer weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">Mídia</span>
              </TabsTrigger>
              <TabsTrigger
                value="dialplan"
                className="flex items-center gap-2 py-2"
              >
                <ListNumbers weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">Discagem</span>
              </TabsTrigger>
              <TabsTrigger value="nat" className="flex items-center gap-2 py-2">
                <WifiHigh weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">NAT</span>
              </TabsTrigger>
            </TabsList>

            {/* ───────────────────── Geral ───────────────────── */}
            <TabsContent
              value="general"
              className="mt-6 space-y-6 focus-visible:outline-none"
            >
              <SectionHeader
                icon={<Info weight="fill" className="h-5 w-5" />}
                title="Informações Básicas"
                subtitle="Como este tronco será identificado dentro da plataforma"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Nome"
                  required
                  hint="Identificador interno, não é enviado ao provedor"
                  error={errors.name}
                >
                  <ElevatedInput
                    type="text"
                    placeholder="Ex.: Tronco Principal Móvel"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={errors.name ? "border-destructive" : ""}
                  />
                </Field>

                <Field
                  label="Tipo de linha"
                  hint="Usado para roteamento de campanhas"
                >
                  <ElevatedSelect
                    value={trunkType}
                    onValueChange={(v) => setTrunkType(v as TrunkType)}
                  >
                    <ElevatedSelectItem value="mobile">
                      Móvel (celular)
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="fixed">
                      Fixo (linha fixa)
                    </ElevatedSelectItem>
                  </ElevatedSelect>
                </Field>

                <Field
                  label="Descrição"
                  hint="Opcional, notas livres para sua equipe"
                  className="md:col-span-2"
                >
                  <textarea
                    placeholder="Ex.: Tronco SIP da operadora X usado para campanhas outbound"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder-slate-400 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </Field>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Modo de operação
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setIsRotational(false)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      !isRotational
                        ? "border-primary bg-muted/30 ring-2 ring-primary/20"
                        : "border-border hover:border-foreground/20",
                    )}
                  >
                    <p className="font-medium text-foreground">Número único</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Um único número de telefone permanente
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRotational(true)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      isRotational
                        ? "border-primary bg-muted/30 ring-2 ring-primary/20"
                        : "border-border hover:border-foreground/20",
                    )}
                  >
                    <p className="font-medium text-foreground">Rotacional</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Provedor atribui múltiplos números dinamicamente
                    </p>
                  </button>
                </div>

                {!isRotational && (
                  <Field
                    label="Número de telefone"
                    required
                    hint="Formato internacional E.164 (com código do país)"
                    error={errors.phoneNumber}
                  >
                    <ElevatedInput
                      type="tel"
                      placeholder="+5511999999999"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className={cn(
                        "font-mono",
                        errors.phoneNumber ? "border-destructive" : "",
                      )}
                    />
                  </Field>
                )}
              </div>
            </TabsContent>

            {/* ───────────────────── Conexão ───────────────────── */}
            <TabsContent
              value="connection"
              className="mt-6 space-y-6 focus-visible:outline-none"
            >
              <SectionHeader
                icon={<Globe weight="fill" className="h-5 w-5" />}
                title="Servidor SIP"
                subtitle="Credenciais e endereço do provedor"
              />

              <div className="grid gap-4 md:grid-cols-3">
                <Field
                  label="Host"
                  required
                  hint="Endereço do servidor SIP (sem porta)"
                  error={errors.host}
                  className="md:col-span-2"
                >
                  <ElevatedInput
                    type="text"
                    placeholder="sip.provider.com"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className={cn(
                      "font-mono",
                      errors.host ? "border-destructive" : "",
                    )}
                  />
                </Field>

                <Field
                  label="Porta"
                  required
                  hint="Padrão: 5060 (UDP/TCP) · 5061 (TLS)"
                  error={errors.port}
                >
                  <ElevatedInput
                    type="number"
                    placeholder="5060"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className={cn(
                      "font-mono",
                      errors.port ? "border-destructive" : "",
                    )}
                  />
                </Field>

                <Field
                  label="Usuário SIP"
                  required
                  hint="Fornecido pelo provedor"
                  error={errors.username}
                >
                  <ElevatedInput
                    type="text"
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={cn(
                      "font-mono",
                      errors.username ? "border-destructive" : "",
                    )}
                  />
                </Field>

                <Field
                  label="Senha SIP"
                  required={mode === "create"}
                  hint={
                    mode === "edit"
                      ? "Deixe em branco para manter a senha atual"
                      : "Armazenada criptografada"
                  }
                  error={errors.password}
                  className="md:col-span-2"
                >
                  <ElevatedInput
                    type="password"
                    placeholder={mode === "edit" ? "••••••••" : "Senha SIP"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(
                      "font-mono",
                      errors.password ? "border-destructive" : "",
                    )}
                  />
                </Field>

                <Field
                  label="Domínio"
                  hint="Padrão: usa o Host como domínio SIP"
                >
                  <ElevatedInput
                    type="text"
                    placeholder="(opcional)"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="font-mono"
                  />
                </Field>

                <Field
                  label="Transporte"
                  hint="UDP padrão. TLS recomendado em redes públicas"
                  className="md:col-span-2"
                >
                  <ElevatedSelect
                    value={transport}
                    onValueChange={(v) => setTransport(v as TransportType)}
                  >
                    <ElevatedSelectItem value="udp">
                      UDP, padrão, mais compatível
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="tcp">
                      TCP, confiável, sem perda de mensagens
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="tls">
                      TLS, criptografado (recomendado)
                    </ElevatedSelectItem>
                  </ElevatedSelect>
                </Field>
              </div>
            </TabsContent>

            {/* ───────────────────── Registro ───────────────────── */}
            <TabsContent
              value="registration"
              className="mt-6 space-y-6 focus-visible:outline-none"
            >
              <SectionHeader
                icon={<ShieldCheck weight="fill" className="h-5 w-5" />}
                title="Registro & Autenticação"
                subtitle="Comportamento de REGISTER, identidade e session timers"
              />

              <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                <Gear weight="bold" className="mr-1.5 inline h-3.5 w-3.5" />
                Todos os campos abaixo são opcionais. Em branco = usa o padrão
                do sistema.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <ToggleRow
                  label="Registro SIP habilitado"
                  hint="Padrão: ligado. Envia REGISTER ao servidor."
                  checked={advanced.registerEnabled ?? true}
                  onChange={(v) => setAdv("registerEnabled", v)}
                />

                <Field
                  label="Expiração do registro (s)"
                  hint="Padrão: 3600 (1 hora). Tempo até precisar reenviar REGISTER."
                >
                  <ElevatedInput
                    type="number"
                    placeholder="3600"
                    value={advanced.registerExpirySeconds?.toString() ?? ""}
                    onChange={(e) =>
                      setAdv(
                        "registerExpirySeconds",
                        parseOptionalInt(e.target.value),
                      )
                    }
                    className="font-mono"
                  />
                </Field>

                <Field
                  label="Retry após falha (s)"
                  hint="Padrão: 30. Tempo antes de tentar registrar novamente."
                >
                  <ElevatedInput
                    type="number"
                    placeholder="30"
                    value={advanced.registerRetrySeconds?.toString() ?? ""}
                    onChange={(e) =>
                      setAdv(
                        "registerRetrySeconds",
                        parseOptionalInt(e.target.value),
                      )
                    }
                    className="font-mono"
                  />
                </Field>

                <Field
                  label="Auth Username"
                  hint="Padrão: usa o Usuário SIP. Sobrescreva apenas se o provedor exigir."
                >
                  <ElevatedInput
                    type="text"
                    placeholder="(usar Usuário SIP)"
                    value={advanced.authUsername ?? ""}
                    onChange={(e) =>
                      setAdv("authUsername", e.target.value || undefined)
                    }
                    className="font-mono"
                  />
                </Field>

                <Field
                  label="Outbound Proxy"
                  hint="Proxy SIP intermediário (host:porta). Padrão: nenhum."
                >
                  <ElevatedInput
                    type="text"
                    placeholder="proxy.provider.com:5060"
                    value={advanced.outboundProxy ?? ""}
                    onChange={(e) =>
                      setAdv("outboundProxy", e.target.value || undefined)
                    }
                    className="font-mono"
                  />
                </Field>

                <Field
                  label="User-Agent"
                  hint={`Padrão: ${getBrand().name}. Apenas se o provedor exigir.`}
                >
                  <ElevatedInput
                    type="text"
                    placeholder={`${getBrand().name}/1.0`}
                    value={advanced.userAgent ?? ""}
                    onChange={(e) =>
                      setAdv("userAgent", e.target.value || undefined)
                    }
                    className="font-mono"
                  />
                </Field>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Session Timers (RFC 4028)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Re-INVITE periódico para manter a chamada viva
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={advanced.sessionTimerEnabled ?? false}
                    onChange={(e) =>
                      setAdv("sessionTimerEnabled", e.target.checked)
                    }
                    className="h-5 w-5 cursor-pointer accent-primary"
                  />
                </div>

                {advanced.sessionTimerEnabled && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field
                      label="Session-Expires (s)"
                      hint="Padrão: 1800 (30 min)"
                    >
                      <ElevatedInput
                        type="number"
                        placeholder="1800"
                        value={advanced.sessionTimerSeconds?.toString() ?? ""}
                        onChange={(e) =>
                          setAdv(
                            "sessionTimerSeconds",
                            parseOptionalInt(e.target.value),
                          )
                        }
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Min-SE (s)" hint="Padrão: 90">
                      <ElevatedInput
                        type="number"
                        placeholder="90"
                        value={advanced.minSESeconds?.toString() ?? ""}
                        onChange={(e) =>
                          setAdv(
                            "minSESeconds",
                            parseOptionalInt(e.target.value),
                          )
                        }
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Refresher" hint="Quem envia o re-INVITE">
                      <ElevatedSelect
                        value={advanced.sessionRefresher ?? ""}
                        onValueChange={(v) =>
                          setAdv(
                            "sessionRefresher",
                            (v as SessionRefresher) || undefined,
                          )
                        }
                      >
                        <ElevatedSelectItem value="">
                          Automático
                        </ElevatedSelectItem>
                        <ElevatedSelectItem value="uac">
                          UAC (cliente)
                        </ElevatedSelectItem>
                        <ElevatedSelectItem value="uas">
                          UAS (servidor)
                        </ElevatedSelectItem>
                      </ElevatedSelect>
                    </Field>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ───────────────────── Mídia ───────────────────── */}
            <TabsContent
              value="media"
              className="mt-6 space-y-6 focus-visible:outline-none"
            >
              <SectionHeader
                icon={<Equalizer weight="fill" className="h-5 w-5" />}
                title="Codecs & Mídia"
                subtitle="Negociação de áudio, SRTP e parâmetros RTP"
              />

              <Field
                label="Codecs (ordem de preferência)"
                hint={`Em branco = sistema usa o padrão${
                  defaultCodecSummary ? ` (${defaultCodecSummary})` : ""
                }. Selecione e ordene para sobrescrever, a operadora escolhe o primeiro codec em comum.`}
              >
                <CodecPicker
                  value={advanced.codecs ?? []}
                  catalog={codecCatalog}
                  onChange={(next) =>
                    setAdv("codecs", next.length > 0 ? next : undefined)
                  }
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-3">
                <Field
                  label="SRTP (mídia segura)"
                  hint="Criptografia RTP via SDES (RFC 3711). Padrão: desabilitado."
                >
                  <ElevatedSelect
                    value={advanced.srtpMode ?? "disabled"}
                    onValueChange={(v) => setAdv("srtpMode", v as SRTPMode)}
                  >
                    <ElevatedSelectItem value="disabled">
                      Desabilitado (RTP claro)
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="optional">
                      Opcional (oferece ambos)
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="required">
                      Obrigatório (apenas SRTP)
                    </ElevatedSelectItem>
                  </ElevatedSelect>
                </Field>

                <Field
                  label="DTMF Payload Type"
                  hint="Padrão: 101 (RFC 4733). Apenas se o provedor exigir."
                >
                  <ElevatedInput
                    type="number"
                    placeholder="101"
                    value={advanced.dtmfPayloadType?.toString() ?? ""}
                    onChange={(e) =>
                      setAdv(
                        "dtmfPayloadType",
                        parseOptionalInt(e.target.value),
                      )
                    }
                    className="font-mono"
                  />
                </Field>

                <Field
                  label="Packet Time (ms)"
                  hint="Padrão: 20ms. Tamanho de cada pacote RTP."
                >
                  <ElevatedInput
                    type="number"
                    placeholder="20"
                    value={advanced.ptimeMs?.toString() ?? ""}
                    onChange={(e) =>
                      setAdv("ptimeMs", parseOptionalInt(e.target.value))
                    }
                    className="font-mono"
                  />
                </Field>
              </div>
            </TabsContent>

            {/* ───────────────────── Discagem ───────────────────── */}
            <TabsContent
              value="dialplan"
              className="mt-6 space-y-6 focus-visible:outline-none"
            >
              <SectionHeader
                icon={<ListNumbers weight="fill" className="h-5 w-5" />}
                title="Plano de Discagem"
                subtitle="Transformações aplicadas a números de saída e entrada"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Prefixo de discagem"
                  hint="Adicionado antes do número. Ex.: '0' para PABX. Padrão: nenhum."
                >
                  <ElevatedInput
                    type="text"
                    placeholder="(nenhum)"
                    value={advanced.dialPrefix ?? ""}
                    onChange={(e) =>
                      setAdv("dialPrefix", e.target.value || undefined)
                    }
                    className="font-mono"
                  />
                </Field>

                <Field
                  label="Remover N primeiros dígitos"
                  hint="Aplicado ao número discado. Padrão: 0."
                >
                  <ElevatedInput
                    type="number"
                    placeholder="0"
                    value={advanced.dialStripDigits?.toString() ?? ""}
                    onChange={(e) =>
                      setAdv(
                        "dialStripDigits",
                        parseOptionalInt(e.target.value),
                      )
                    }
                    className="font-mono"
                  />
                </Field>

                <Field
                  label="Formato do número"
                  hint="Normalização aplicada antes das transformações"
                >
                  <ElevatedSelect
                    value={advanced.numberFormat ?? "passthrough"}
                    onValueChange={(v) =>
                      setAdv("numberFormat", v as NumberFormat)
                    }
                  >
                    <ElevatedSelectItem value="passthrough">
                      Sem normalização (padrão)
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="e164">
                      E.164 (+55…)
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="national">
                      Nacional
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="local">Local</ElevatedSelectItem>
                  </ElevatedSelect>
                </Field>

                <Field
                  label="Timeout de chamada entrante (s)"
                  hint="Padrão: 30. Tempo máximo tocando antes de desistir."
                >
                  <ElevatedInput
                    type="number"
                    placeholder="30"
                    value={advanced.ringingTimeoutSeconds?.toString() ?? ""}
                    onChange={(e) =>
                      setAdv(
                        "ringingTimeoutSeconds",
                        parseOptionalInt(e.target.value),
                      )
                    }
                    className="font-mono"
                  />
                </Field>

                <div className="md:col-span-2">
                  <ToggleRow
                    label="Ocultar Caller ID (Privacy)"
                    hint="Adiciona cabeçalho Privacy: id ao INVITE de saída. Padrão: desligado."
                    checked={advanced.hideCallerId ?? false}
                    onChange={(v) => setAdv("hideCallerId", v)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* ───────────────────── NAT ───────────────────── */}
            <TabsContent
              value="nat"
              className="mt-6 space-y-6 focus-visible:outline-none"
            >
              <SectionHeader
                icon={<WifiHigh weight="fill" className="h-5 w-5" />}
                title="Rede & NAT"
                subtitle="Bind local, IP público e STUN para travessia de NAT"
              />

              <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                Padrão: descoberta automática de IP público (ipify + STUN
                fallback). Ajuste apenas se houver problemas de áudio
                unidirecional ou NAT estrito.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Bind Host"
                  hint="Interface local para SIP/RTP. Padrão: 0.0.0.0 (todas)."
                >
                  <ElevatedInput
                    type="text"
                    placeholder="0.0.0.0"
                    value={advanced.bindHost ?? ""}
                    onChange={(e) =>
                      setAdv("bindHost", e.target.value || undefined)
                    }
                    className="font-mono"
                  />
                </Field>

                <Field
                  label="Bind Port"
                  hint="Padrão: 0 (porta aleatória atribuída pelo SO)"
                >
                  <ElevatedInput
                    type="number"
                    placeholder="0"
                    value={advanced.bindPort?.toString() ?? ""}
                    onChange={(e) =>
                      setAdv("bindPort", parseOptionalInt(e.target.value))
                    }
                    className="font-mono"
                  />
                </Field>

                <Field
                  label="Modo de IP público"
                  hint="Como o tronco descobre o IP a anunciar no SDP/Contact"
                >
                  <ElevatedSelect
                    value={advanced.publicAddressMode ?? "auto"}
                    onValueChange={(v) =>
                      setAdv("publicAddressMode", v as PublicAddressMode)
                    }
                  >
                    <ElevatedSelectItem value="auto">
                      Automático (ipify + STUN), padrão
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="stun">
                      Somente STUN
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="manual">
                      Manual (informar abaixo)
                    </ElevatedSelectItem>
                  </ElevatedSelect>
                </Field>

                <Field
                  label="IP público (manual)"
                  hint={
                    advanced.publicAddressMode === "manual"
                      ? "Endereço IPv4 fixo do gateway externo"
                      : "Ativo apenas quando modo = Manual"
                  }
                >
                  <ElevatedInput
                    type="text"
                    placeholder="203.0.113.10"
                    value={advanced.publicAddress ?? ""}
                    onChange={(e) =>
                      setAdv("publicAddress", e.target.value || undefined)
                    }
                    disabled={advanced.publicAddressMode !== "manual"}
                    className={cn(
                      "font-mono",
                      advanced.publicAddressMode !== "manual" && "opacity-50",
                    )}
                  />
                </Field>

                <div className="md:col-span-2">
                  <ToggleRow
                    label="STUN habilitado"
                    hint="Descobre IP público via servidores STUN. Padrão: desligado."
                    checked={advanced.stunEnabled ?? false}
                    onChange={(v) => setAdv("stunEnabled", v)}
                  />
                </div>

                <Field
                  label="Servidores STUN (um por linha)"
                  hint="Padrão: stun.l.google.com:19302 quando STUN está ligado"
                  className="md:col-span-2"
                >
                  <textarea
                    placeholder="stun.l.google.com:19302&#10;stun1.l.google.com:19302"
                    value={(advanced.stunServers ?? []).join("\n")}
                    onChange={(e) => {
                      const lines = e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0);
                      setAdv(
                        "stunServers",
                        lines.length > 0 ? lines : undefined,
                      );
                    }}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 font-mono text-sm text-foreground placeholder-slate-400 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </Field>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            title={t("cancel")}
            link="/dashboard/sip-trunks"
            newTab={false}
            disabled={isPending}
            className="text-[11px] font-semibold uppercase"
          />
          <Button
            variant="action"
            title={
              isPending
                ? t("saving")
                : mode === "create"
                  ? t("create")
                  : t("save")
            }
            icon={
              isPending ? (
                <CircleNotch weight="bold" className="h-4 w-4 animate-spin" />
              ) : (
                <Plugs weight="bold" className="h-4 w-4" />
              )
            }
            iconVisible
            iconSide="left"
            onClick={handleSubmit}
            disabled={isPending}
            className="text-[11px] font-semibold uppercase"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}


function RecommendedBadge() {
  return (
    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
      Recomendado
    </span>
  );
}

interface CodecPickerProps {
  value: CodecID[];
  catalog: SupportedCodec[];
  onChange: (next: CodecID[]) => void;
}

function CodecPicker({ value, catalog, onChange }: CodecPickerProps) {
  const selected = value;
  const unselected = useMemo(
    () => catalog.filter((c) => !selected.includes(c.id)),
    [catalog, selected],
  );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= selected.length) return;
    const next = selected.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const remove = (id: CodecID) => onChange(selected.filter((c) => c !== id));
  const add = (id: CodecID) => onChange([...selected, id]);

  return (
    <div className="space-y-2">
      {selected.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Nenhum codec selecionado, sistema usará o padrão.
        </p>
      ) : (
        <ul className="space-y-2">
          {selected.map((id, idx) => {
            const meta = catalog.find((c) => c.id === id);
            const unsupported = !meta;
            return (
              <li
                key={id}
                className={cn(
                  "flex items-center justify-between rounded-xl border bg-card px-4 py-3",
                  unsupported ? "border-amber-500/40" : "border-border",
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-xs font-bold text-primary-foreground">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {meta?.label ?? id.toUpperCase()}
                      {meta?.recommended && <RecommendedBadge />}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        unsupported
                          ? "text-amber-600"
                          : "text-muted-foreground",
                      )}
                    >
                      {meta?.description ??
                        "Não suportado pelo sistema, remova este codec."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(idx, idx - 1)}
                    disabled={idx === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Mover para cima"
                  >
                    <ArrowUp weight="bold" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, idx + 1)}
                    disabled={idx === selected.length - 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Mover para baixo"
                  >
                    <ArrowDown weight="bold" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    className="ml-2 rounded-lg border border-destructive/30 px-2 py-1 text-xs font-semibold uppercase text-destructive transition-colors hover:bg-destructive/10"
                  >
                    Remover
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {unselected.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {unselected.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => add(c.id)}
              title={c.description}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              + {c.label}
              {c.recommended && <RecommendedBadge />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
