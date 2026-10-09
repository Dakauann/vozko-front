import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";

function Portuguese({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      {children}
    </NextIntlClientProvider>
  );
}

export function renderInPortuguese(ui: ReactElement) {
  return render(ui, { wrapper: Portuguese });
}
