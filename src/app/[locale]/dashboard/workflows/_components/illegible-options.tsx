"use client";

import ElevatedButton from "@/components/elevated-design/button";
import { Notice } from "@/components/ui/notice";

export function IllegibleOptions({ onReset }: { onReset: () => void }) {
  return (
    <Notice tone="warning" title="Configuração ilegível">
      <p>
        As opções salvas neste nó não estão no formato que o servidor grava. O servidor corrige o formato ao
        salvar: salve e recarregue o fluxo, ou recomece as opções do zero.
      </p>
      <ElevatedButton variant="outline-subtle" size="sm" title="Recomeçar as opções" onClick={onReset} />
    </Notice>
  );
}
