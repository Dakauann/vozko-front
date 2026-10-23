import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { SendStep, type SendStepProps } from "../SendStep";

const ZONE = "America/Sao_Paulo";

function renderStep(overrides: Partial<SendStepProps> = {}) {
  const onLaunch = vi.fn().mockResolvedValue(true);
  const onReady = vi.fn().mockResolvedValue(true);
  const props: SendStepProps = {
    timeZone: ZONE,
    scheduledAt: null,
    scheduled: false,
    blocking: 0,
    can: { now: true, schedule: true, ready: true },
    startAllowed: true,
    launching: false,
    refused: [],
    summary: [{ label: "Campanha", value: "Black Friday" }],
    confirm: {
      now: { title: "Enviar agora?", body: "Sai para 990 contatos." },
      schedule: (iso) => ({ title: "Agendar?", body: `Sai em ${iso ?? "nunca"}.` }),
      note: <p>Nota do canal</p>,
    },
    onLaunch,
    onReady,
    ...overrides,
  };
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone={ZONE}>
      <SendStep {...props} />
    </NextIntlClientProvider>,
  );
  return { onLaunch, onReady };
}

describe("SendStep", () => {
  it("sends now after the confirm dialog with no schedule", async () => {
    const { onLaunch, onReady } = renderStep();
    expect(screen.getByRole("radio", { name: /Enviar agora/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("O envio começa assim que você confirmar.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disparar campanha" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Enviar agora?")).toBeInTheDocument();
    expect(within(dialog).getByText("Sai para 990 contatos.")).toBeInTheDocument();
    expect(within(dialog).getByText("Nota do canal")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Disparar" }));
    await waitFor(() => expect(onLaunch).toHaveBeenCalledWith(null));
    expect(onReady).not.toHaveBeenCalled();
  });

  it("schedules with the chosen time in the zone and shows the channel extra", async () => {
    const { onLaunch } = renderStep({ scheduleExtra: <p>Repetir toda semana</p> });
    expect(screen.queryByText("Repetir toda semana")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Agendar/ }));
    expect(screen.getByText("Repetir toda semana")).toBeInTheDocument();
    expect(screen.getByText(`Horário em ${ZONE}.`)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Data e hora do envio"), { target: { value: "2030-11-20T09:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Agendar campanha" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Sai em 2030-11-20T12:30:00.000Z.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Agendar" }));
    await waitFor(() => expect(onLaunch).toHaveBeenCalledWith("2030-11-20T12:30:00.000Z"));
  });

  it("leaves the campaign ready without a dialog", async () => {
    const { onLaunch, onReady } = renderStep();
    fireEvent.click(screen.getByRole("radio", { name: /Deixar pronta/ }));
    expect(screen.getByText("A campanha fica pronta e você inicia quando quiser.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deixar pronta" }));
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onLaunch).not.toHaveBeenCalled();
  });

  it("stays disabled while the review blocks and says how many blocks there are", () => {
    renderStep({ blocking: 2 });
    expect(screen.getByText("Ainda não dá para disparar")).toBeInTheDocument();
    expect(screen.getByText(/Há 2 impedimentos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disparar campanha" })).toBeDisabled();
  });

  it("stays disabled while the review is loading", () => {
    renderStep({ blocking: null });
    expect(screen.queryByText("Ainda não dá para disparar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disparar campanha" })).toBeDisabled();
  });

  it("disables a choice the person may not run and lists refused issues", () => {
    renderStep({ can: { now: false, schedule: true, ready: true }, startAllowed: false, refused: [{ key: "a", text: "Modelo pausado" }] });
    expect(screen.getByRole("button", { name: "Disparar campanha" })).toBeDisabled();
    expect(screen.getByText("Você não tem permissão para disparar campanhas.")).toBeInTheDocument();
    expect(screen.getByText("O servidor recusou o disparo")).toBeInTheDocument();
    expect(screen.getByText("Modelo pausado")).toBeInTheDocument();
  });

  it("lets a channel own the schedule fields and gate the button", () => {
    renderStep({ hideScheduleInput: true, scheduleIncomplete: true, scheduleExtra: <p>Recorrência</p> });
    fireEvent.click(screen.getByRole("radio", { name: /Agendar/ }));
    expect(screen.queryByLabelText("Data e hora do envio")).not.toBeInTheDocument();
    expect(screen.getByText("Recorrência")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agendar campanha" })).toBeDisabled();
  });

  it("opens on Agendar with Reagendar for a scheduled campaign and reports mode changes", () => {
    const onModeChange = vi.fn();
    renderStep({ scheduled: true, scheduledAt: "2030-11-20T12:30:00.000Z", onModeChange, summary: [{ label: "Contatos", value: "990" }] });
    expect(screen.getByRole("radio", { name: /Agendar/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Data e hora do envio")).toHaveValue("2030-11-20T09:30");
    expect(screen.getByRole("button", { name: "Reagendar" })).toBeEnabled();
    expect(within(screen.getByRole("complementary", { name: "Resumo" })).getByText("990")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Deixar pronta/ }));
    expect(onModeChange).toHaveBeenCalledWith("ready");
  });
});
