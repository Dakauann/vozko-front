"use client";

import {
  ArrowRight,
  Buildings,
  CheckCircle,
  Envelope,
  IdentificationCard,
  Lock,
  LockKey,
  User,
  UserPlus,
} from "@/components/icons";
import {
  adminRegisterUserAction,
  adminSendEmailVerificationAction,
} from "@/app/actions/users";
import { useCallback, useEffect, useState, useTransition } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";

type AccountType = "company" | "individual";


const digitsOnly = (value: string) => value.replace(/\D/g, "");

const formatCPF = (value: string) => {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const formatCNPJ = (value: string) => {
  const d = digitsOnly(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const isRepeated = (s: string) => /^([0-9])\1*$/.test(s);

const validateCPF = (value: string) => {
  const d = digitsOnly(value);
  if (d.length !== 11 || isRepeated(d)) return false;
  const calc = (len: number) => {
    const s = d
      .slice(0, len)
      .split("")
      .reduce((a, c, i) => a + Number(c) * (len + 1 - i), 0);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
};

const validateCNPJ = (value: string) => {
  const d = digitsOnly(value);
  if (d.length !== 14 || isRepeated(d)) return false;
  const calc = (len: number) => {
    const w =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = d
      .slice(0, len)
      .split("")
      .reduce((a, c, i) => a + Number(c) * w[i], 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
};

const validateEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);


export default function AdminRegisterUserPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("individual");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [lastSent, setLastSent] = useState<Date | null>(null);

  const isAdmin =
    user?.role === "admin" ||
    user?.role === "ADMIN" ||
    user?.role === "administrator";

  useEffect(() => {
    if (!lastSent) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - lastSent.getTime()) / 1000);
      const remaining = Math.max(0, 30 - elapsed);
      setCountdown(remaining);
      if (remaining === 0) setLastSent(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastSent]);

  const handleSendCode = useCallback(async () => {
    if (!validateEmail(email)) {
      setError("E-mail inválido");
      return;
    }
    setError("");
    const result = await adminSendEmailVerificationAction(email);
    if (result.error) {
      setError(result.error);
    } else {
      setLastSent(new Date());
    }
  }, [email]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres");
      return;
    }

    const doc = digitsOnly(accountType === "company" ? cnpj : cpf);

    if (accountType === "company") {
      if (!doc) {
        setError("CNPJ obrigatório");
        return;
      }
      if (!validateCNPJ(doc)) {
        setError("CNPJ inválido");
        return;
      }
    } else {
      if (!doc) {
        setError("CPF obrigatório");
        return;
      }
      if (!validateCPF(doc)) {
        setError("CPF inválido");
        return;
      }
    }

    startTransition(async () => {
      const result = await adminRegisterUserAction({
        name,
        email,
        password,
        customerType: accountType,
        verificationToken,
        ...(accountType === "company" ? { cnpj: doc } : { cpf: doc }),
      });

      if (result.error) {
        const status = (result as { statusCode?: number }).statusCode;
        switch (status) {
          case 400:
            setError("Token de verificação inválido ou expirado");
            break;
          case 409:
            setError("Este e-mail já está cadastrado");
            break;
          default:
            setError(result.error);
        }
      } else {
        setSuccess(
          `Usuário ${result.user?.name} (${result.user?.email}) criado com sucesso!`,
        );
        setName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setCpf("");
        setCnpj("");
        setVerificationToken("");
      }
    });
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">
          Acesso restrito a administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <DashboardPageHeader
        back={{
          onClick: () => router.push("/dashboard/users"),
          label: "Voltar",
        }}
        icon={<UserPlus className="h-5 w-5" weight="fill" />}
        badge="Registrar Usuário"
        title="Registrar Usuário"
        description="Crie uma nova conta de usuário no sistema"
      />

      {/* Success banner */}
      {success && (
        <div>
          <ElevatedContainer className="rounded-lg border border-border bg-muted p-4">
            <div className="flex items-center gap-3">
              <CheckCircle
                className="h-5 w-5 text-healthy-ink flex-shrink-0"
                weight="fill"
              />
              <p className="text-sm text-healthy-ink font-medium">{success}</p>
            </div>
          </ElevatedContainer>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-muted border border-border rounded-[--radius]">
          <p className="text-sm text-destructive-ink font-medium">{error}</p>
        </div>
      )}

      {/* Form */}
      <ElevatedContainer className="rounded-lg border border-border bg-card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Account Type */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-3">
              Tipo de Conta <span className="text-destructive-ink">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setAccountType("individual");
                  setCnpj("");
                  setError("");
                }}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-[--radius] border transition-all ${
                  accountType === "individual"
                    ? "border-primary bg-card text-foreground shadow-sm"
                    : "border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted"
                }`}
              >
                <User
                  weight={accountType === "individual" ? "fill" : "regular"}
                  className={`w-6 h-6 ${accountType === "individual" ? "text-primary-ink" : "text-muted-foreground"}`}
                />
                <span className="text-sm font-semibold">Pessoa Física</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccountType("company");
                  setCpf("");
                  setError("");
                }}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-[--radius] border transition-all ${
                  accountType === "company"
                    ? "border-primary bg-card text-foreground shadow-sm"
                    : "border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted"
                }`}
              >
                <Buildings
                  weight={accountType === "company" ? "fill" : "regular"}
                  className={`w-6 h-6 ${accountType === "company" ? "text-primary-ink" : "text-muted-foreground"}`}
                />
                <span className="text-sm font-semibold">Pessoa Jurídica</span>
              </button>
            </div>
          </div>

          {/* Name */}
          <ElevatedInput
            type="text"
            label="Nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon={<User weight="fill" className="w-5 h-5" />}
            required
          />

          {/* Email + verification */}
          <ElevatedInput
            type="email"
            label="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Envelope weight="fill" className="w-5 h-5" />}
            required
          />

          {validateEmail(email) && (
            <div className="space-y-3">
              <ElevatedInput
                type="text"
                label="Código de verificação"
                value={verificationToken}
                onChange={(e) => setVerificationToken(e.target.value)}
                icon={<LockKey weight="fill" className="w-5 h-5" />}
                required
              />
              <Button
                variant="outline-subtle"
                size="sm"
                onClick={handleSendCode}
                disabled={countdown > 0}
                title={
                  countdown > 0
                    ? `Reenviar em ${countdown}s`
                    : "Enviar código de verificação"
                }
              />
            </div>
          )}

          {/* Document */}
          {accountType === "individual" && (
            <ElevatedInput
              type="text"
              label="CPF"
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
              icon={<IdentificationCard weight="fill" className="w-5 h-5" />}
              inputMode="numeric"
              maxLength={14}
              required
            />
          )}
          {accountType === "company" && (
            <ElevatedInput
              type="text"
              label="CNPJ"
              value={cnpj}
              onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
              icon={<IdentificationCard weight="fill" className="w-5 h-5" />}
              inputMode="numeric"
              maxLength={18}
              required
            />
          )}

          {/* Passwords */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ElevatedInput
              type="password"
              label="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock weight="fill" className="w-5 h-5" />}
              required
            />
            <ElevatedInput
              type="password"
              label="Confirmar senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={<Lock weight="fill" className="w-5 h-5" />}
              required
            />
          </div>

          {/* Submit */}
          <Button
            variant="main-cta"
            size="lg"
            type="submit"
            className="w-full"
            title={isPending ? "Registrando..." : "Registrar Usuário"}
            disabled={isPending}
            icon={<UserPlus weight="bold" className="w-5 h-5" />}
            iconVisible
            iconSide="right"
          />
        </form>
      </ElevatedContainer>
    </div>
  );
}
