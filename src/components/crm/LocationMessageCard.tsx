"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { acceptLeadLocationAction } from "@/app/actions/leads";
import Button from "@/components/elevated-design/button";
import { CheckCircle, CircleNotch, MapPin } from "@/components/icons";
import { MiniMap } from "@/components/maps/MiniMap";
import { useWorkspace } from "@/contexts/workspace-context";
import { useInView } from "@/hooks/use-in-view";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { locationPlace } from "@/lib/conversations/message-location";
import type { MessageLocation } from "@/lib/conversations/types";
import { leadFirstName, leadNameLines } from "@/lib/leads/display";

const COORDINATE_DIGITS = { minimumFractionDigits: 5, maximumFractionDigits: 5 } as const;

export function LocationMessageCard({
  messageId,
  location,
  leadId,
  leadName,
  leadNumber,
}: {
  messageId: string;
  location: MessageLocation;
  leadId?: string;
  leadName: string;
  leadNumber: string;
}) {
  const t = useTranslations("crm.locationMessage");
  const format = useFormatter();
  const { can } = useWorkspace();
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const inFlight = useRef(false);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [mapFrame, mapVisible] = useInView<HTMLDivElement>();

  useEffect(() => {
    if (accepted) statusRef.current?.focus();
  }, [accepted]);

  const firstName = leadFirstName(leadNameLines({ realName: leadName, number: leadNumber }));
  const place =
    locationPlace(location) ||
    t("coordinates", {
      latitude: format.number(location.latitude, COORDINATE_DIGITS),
      longitude: format.number(location.longitude, COORDINATE_DIGITS),
    });
  const acceptable = location.candidate && Boolean(leadId) && Boolean(messageId) && can("leads", "update");

  const accept = async () => {
    if (!leadId || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    const outcome = await acceptLeadLocationAction(leadId, messageId);
    inFlight.current = false;
    setSaving(false);
    if (!outcome.lead) {
      toast.error(codedErrorMessage(t, outcome.error, t("failed")));
      return;
    }
    setAccepted(true);
  };

  return (
    <div className="w-[260px] max-w-full space-y-1.5">
      <div ref={mapFrame} className="h-[110px] w-full">
        {mapVisible ? (
          <MiniMap
            position={{ lat: location.latitude, lng: location.longitude }}
            precision="exact"
            interactive={false}
            draggable={false}
            ariaLabel={t("mapLabel")}
            className="h-[110px] rounded-[--radius]"
          />
        ) : (
          <span aria-hidden="true" className="block h-full w-full rounded-[--radius] border border-border bg-muted" />
        )}
      </div>
      <p className="px-0.5 text-xs text-muted-foreground">{t("caption", { place })}</p>
      {acceptable ? (
        <p
          ref={statusRef}
          role="status"
          tabIndex={-1}
          className={accepted ? "flex items-center gap-1.5 px-0.5 text-xs font-medium text-foreground" : "sr-only"}
        >
          {accepted ? (
            <>
              <CheckCircle weight="fill" className="h-3.5 w-3.5 shrink-0 text-healthy-ink" aria-hidden />
              {firstName ? t("accepted", { name: firstName }) : t("acceptedUnnamed")}
            </>
          ) : null}
        </p>
      ) : null}
      {acceptable && !accepted ? (
        <Button
          variant="secondary"
          size="sm"
          className="w-full whitespace-normal"
          titleClassName="text-center leading-tight"
          icon={saving ? <CircleNotch className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
          iconVisible
          title={saving ? t("accepting") : firstName ? t("accept", { name: firstName }) : t("acceptUnnamed")}
          disabled={saving}
          onClick={() => void accept()}
        />
      ) : null}
    </div>
  );
}
