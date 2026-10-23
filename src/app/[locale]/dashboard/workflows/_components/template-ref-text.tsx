"use client";

import { Fragment, useMemo, useState } from "react";
import { useNodeId } from "@xyflow/react";

import { templateSegments } from "@/lib/workflows/variable-catalog";

import { useCatalogSource } from "./variable-catalog-context";

function RefToken({ text, refName }: { text: string; refName: string }) {
  const nodeId = useNodeId();
  const source = useCatalogSource();
  const [label, setLabel] = useState<string | undefined>(undefined);

  const resolve = () => {
    if (!nodeId || !source || label !== undefined) return;
    void source.loader.load(source.draft(), nodeId).then((answer) => {
      if (!("catalog" in answer)) return;
      const known = answer.catalog.variables.find((item) => item.ref === refName);
      if (known) setLabel(known.label);
    });
  };

  return (
    <span onPointerEnter={resolve} title={label}>
      {text}
    </span>
  );
}

export function TemplateRefText({ text }: { text: string }) {
  const segments = useMemo(() => templateSegments(text), [text]);
  if (!segments.some((segment) => segment.ref)) return <>{text}</>;
  return (
    <>
      {segments.map((segment, index) =>
        segment.ref ? <RefToken key={index} text={segment.text} refName={segment.ref} /> : <Fragment key={index}>{segment.text}</Fragment>,
      )}
    </>
  );
}
