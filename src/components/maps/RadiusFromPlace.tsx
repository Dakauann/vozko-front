"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { fetchReferencePoint } from "@/app/actions/lead-map";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { CaretDown, CircleNotch, Radius } from "@/components/icons";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { RADIUS_CHOICES_M } from "@/lib/maps/area";
import { hasReferenceQuery, referencePointName } from "@/lib/maps/reference-point";
import type { DistrictCount } from "@/lib/maps/types";
import { cn } from "@/lib/utils";

export type RadiusCenter = Pick<DistrictCount, "name" | "lat" | "lng">;

const KILOMETER = 1000;
const DEFAULT_RADIUS_M = 1000;

const EMPTY_PLACE = { zipCode: "", district: "", city: "", state: "" };

type PlaceField = keyof typeof EMPTY_PLACE;

export function RadiusFromPlace({ onRadius, className }: { onRadius: (center: RadiusCenter, radiusM: number) => void; className?: string }) {
  const t = useTranslations("leadMap.districtList");
  const tForm = useTranslations("leadMap.districtList.radiusFrom");
  const formId = useId();
  const hintId = useId();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(EMPTY_PLACE);
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const radiusLabel = (value: number) =>
    value < KILOMETER ? t("radius.meters", { value }) : t("radius.kilometers", { value: value / KILOMETER });

  const change = (field: PlaceField, value: string) => {
    setPlace((current) => ({ ...current, [field]: value }));
    setRefusal(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (!hasReferenceQuery(place)) {
      setRefusal(tForm("empty"));
      return;
    }
    setBusy(true);
    setRefusal(null);
    const outcome = await fetchReferencePoint(place);
    setBusy(false);
    if (!outcome.point) {
      setRefusal(codedErrorMessage(tForm, outcome.error, tForm("failed")));
      return;
    }
    onRadius({ name: referencePointName(place), lat: outcome.point.position.lat, lng: outcome.point.position.lng }, radiusM);
  };

  const field = (name: PlaceField, extra: { inputMode?: "numeric"; maxLength?: number; autoComplete?: string } = {}) => (
    <ElevatedInput
      id={`${formId}-${name}`}
      label={tForm(name)}
      variant="outline"
      controlSize="sm"
      value={place[name]}
      onChange={(event) => change(name, event.target.value)}
      {...extra}
    />
  );

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex w-fit items-center gap-1.5 rounded-sm text-xs font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Radius size={14} aria-hidden="true" className="text-muted-foreground" />
        {tForm("toggle")}
        <CaretDown size={12} aria-hidden="true" className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <form
          id={formId}
          aria-label={tForm("toggle")}
          aria-describedby={hintId}
          aria-busy={busy}
          noValidate
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-2 rounded-md border border-border p-2"
        >
          <p id={hintId} className="text-xs text-muted-foreground">
            {tForm("hint")}
          </p>
          {field("zipCode", { inputMode: "numeric", maxLength: 9, autoComplete: "postal-code" })}
          {field("district")}
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-2">
            {field("city")}
            {field("state", { maxLength: 2 })}
          </div>
          <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <legend className="mb-1 text-xs font-medium text-foreground">{tForm("radius")}</legend>
            {RADIUS_CHOICES_M.map((value) => (
              <label key={value} className="inline-flex min-h-[34px] items-center gap-1.5 text-xs text-foreground sm:min-h-0">
                <input
                  type="radio"
                  name={`${formId}-radius`}
                  value={value}
                  checked={radiusM === value}
                  onChange={() => setRadiusM(value)}
                  className="accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {radiusLabel(value)}
              </label>
            ))}
          </fieldset>
          {refusal ? (
            <p role="alert" className="text-xs text-destructive-ink">
              {refusal}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={busy}
            icon={busy ? <CircleNotch className="h-3.5 w-3.5 animate-spin" /> : <Radius className="h-3.5 w-3.5" />}
            iconVisible
            title={busy ? tForm("searching") : tForm("submit")}
          />
        </form>
      ) : null}
    </div>
  );
}
