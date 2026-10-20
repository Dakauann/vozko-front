"use client";

import {
  ChatCircle,
  ClipboardText,
  Copy,
  File as FileIcon,
  Gif,
  Image as ImageIcon,
  Link,
  MapPin,
  Phone,
  PhoneCall,
  VideoCamera,
} from "@/components/icons";

import { DraggableComponent } from "./DragDropBuilder";
import Image from "next/image";
import { motion } from "framer-motion";
import { getBrand } from "@/config/brand";
import { fillVariables } from "@/lib/whatsapp-templates/preview";
import { useTranslations } from "next-intl";

interface WhatsAppPreviewProps {
  components: DraggableComponent[];
  templateName?: string;
  language?: string;
}

const BUBBLE = "bg-white text-[#111b21]";
const BUBBLE_MUTED = "text-[#667781]";
const BUBBLE_RULE = "border-[#e9edef]";
const BUBBLE_ACTION = "text-[#027eb5]";
const MEDIA_WELL = "bg-[#f0f2f5]";

export default function WhatsAppPreview({
  components,
  templateName,
  language = "en",
}: WhatsAppPreviewProps) {
  const t = useTranslations("whatsappTemplates.phonePreview");
  const brandName = getBrand().name;
  const headerComponent = components.find((c) => c.type === "HEADER");
  const bodyComponent = components.find((c) => c.type === "BODY");
  const footerComponent = components.find((c) => c.type === "FOOTER");
  const buttonsComponent = components.find((c) => c.type === "BUTTONS");
  const callPermissionComponent = components.find(
    (c) => c.type === "CALL_PERMISSION_REQUEST",
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 bg-[#008069] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              {brandName.trim().charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-white font-semibold text-sm">{brandName}</h3>
            <p className="text-white/70 text-xs">{t("status")}</p>
          </div>
        </div>
      </div>

      <div
        className="flex-1 bg-[#efeae2] p-4 overflow-y-auto"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9d9d9' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        <div className="mb-3 text-center">
          <div className="inline-block max-w-full rounded-lg bg-white/90 px-3 py-1.5 shadow-sm">
            <p className={`truncate text-2xs font-medium ${BUBBLE_MUTED}`}>
              {t("templateTag", {
                name: templateName || t("untitled"),
                language: language.toUpperCase(),
              })}
            </p>
          </div>
        </div>

        {components.length === 0 ? (
          <div className="flex h-[calc(100%-3rem)] flex-col items-center justify-center text-center">
            <div className={`max-w-[15rem] rounded-xl px-5 py-4 shadow-sm ${BUBBLE}`}>
              <div className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full ${MEDIA_WELL}`}>
                <ChatCircle className={`h-5 w-5 ${BUBBLE_MUTED}`} />
              </div>
              <p className="text-xs font-semibold">{t("emptyTitle")}</p>
              <p className={`mt-0.5 text-xs ${BUBBLE_MUTED}`}>{t("emptyDescription")}</p>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="max-w-sm"
          >
            <div className={`rounded-xl rounded-tl-sm shadow-sm overflow-hidden ${BUBBLE}`}>
              {headerComponent && <HeaderPreview component={headerComponent} />}

              <div className="px-3 py-2.5">
                {bodyComponent ? (
                  <BodyPreview component={bodyComponent} />
                ) : (
                  <p className={`text-xs italic ${BUBBLE_MUTED}`}>{t("noBody")}</p>
                )}

                {footerComponent && footerComponent.data.text && (
                  <p className={`mt-1.5 text-xs ${BUBBLE_MUTED}`}>{footerComponent.data.text}</p>
                )}

                <p className={`mt-1 text-right text-2xs tabular-nums ${BUBBLE_MUTED}`}>
                  {new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {buttonsComponent?.data?.buttons &&
                buttonsComponent.data.buttons.length > 0 && (
                  <ButtonsPreview component={buttonsComponent} />
                )}

              {callPermissionComponent && <CallPermissionPreview />}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function MediaPlaceholder({ icon: Glyph, label }: { icon: typeof ImageIcon; label: string }) {
  return (
    <div className="text-center">
      <Glyph className={`h-10 w-10 mx-auto mb-1.5 ${BUBBLE_MUTED}`} weight="duotone" />
      <p className={`text-xs ${BUBBLE_MUTED}`}>{label}</p>
    </div>
  );
}

function HeaderPreview({ component }: { component: DraggableComponent }) {
  const t = useTranslations("whatsappTemplates.phonePreview");
  const { format, text, example } = component.data;

  if (format === "TEXT") {
    return (
      <div className="px-3 pt-3">
        <p className="text-sm font-semibold">
          {text || <span className={`font-normal italic ${BUBBLE_MUTED}`}>{t("headerText")}</span>}
        </p>
      </div>
    );
  }

  if (format === "IMAGE" || format === "GIF") {
    return (
      <div className={`m-1 mb-0 aspect-video rounded-lg flex items-center justify-center relative overflow-hidden ${MEDIA_WELL}`}>
        {example ? (
          <Image src={example} alt="" fill className="object-cover" unoptimized />
        ) : (
          <MediaPlaceholder icon={format === "GIF" ? Gif : ImageIcon} label={format === "GIF" ? t("gifHeader") : t("imageHeader")} />
        )}
      </div>
    );
  }

  if (format === "VIDEO") {
    return (
      <div className={`m-1 mb-0 aspect-video rounded-lg flex items-center justify-center overflow-hidden ${MEDIA_WELL}`}>
        {example ? (
          <video src={example} controls className="w-full h-full" />
        ) : (
          <MediaPlaceholder icon={VideoCamera} label={t("videoHeader")} />
        )}
      </div>
    );
  }

  if (format === "DOCUMENT") {
    return (
      <div className="m-1 mb-0">
        <div className={`flex items-center gap-3 rounded-lg p-3 ${MEDIA_WELL}`}>
          <FileIcon className={`h-8 w-8 shrink-0 ${BUBBLE_MUTED}`} weight="duotone" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{t("document")}</p>
            <p className={`text-2xs ${BUBBLE_MUTED}`}>PDF</p>
          </div>
        </div>
      </div>
    );
  }

  if (format === "LOCATION") {
    return (
      <div className={`m-1 mb-0 aspect-video rounded-lg flex items-center justify-center ${MEDIA_WELL}`}>
        <div className="text-center px-3">
          <MapPin className={`h-10 w-10 mx-auto mb-1.5 ${BUBBLE_MUTED}`} weight="duotone" />
          <p className="text-xs font-medium">{component.data.locationName || t("location")}</p>
          <p className={`text-xs ${BUBBLE_MUTED}`}>{component.data.locationAddress || t("address")}</p>
        </div>
      </div>
    );
  }

  return null;
}

function BodyPreview({ component }: { component: DraggableComponent }) {
  const t = useTranslations("whatsappTemplates.phonePreview");
  const { text, variableExamples } = component.data;

  if (!text) {
    return <p className={`text-xs italic ${BUBBLE_MUTED}`}>{t("emptyBody")}</p>;
  }

  return (
    <p className="text-sm whitespace-pre-wrap leading-relaxed">
      {fillVariables(text, variableExamples)}
    </p>
  );
}

function PreviewAction({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <div className={`flex w-full items-center justify-center gap-2 border-t px-4 py-2.5 text-sm font-medium ${BUBBLE_RULE} ${BUBBLE_ACTION}`}>
      {icon}
      <span className="truncate">{label}</span>
    </div>
  );
}

function ButtonsPreview({ component }: { component: DraggableComponent }) {
  const t = useTranslations("whatsappTemplates.phonePreview");
  const buttons = component.data.buttons || [];

  const fallback: Record<string, string> = {
    QUICK_REPLY: t("buttons.quickReply"),
    URL: t("buttons.url"),
    PHONE_NUMBER: t("buttons.phone"),
    COPY_CODE: t("buttons.copyCode"),
    OTP: t("buttons.otp"),
    FLOW: t("buttons.flow"),
  };

  return (
    <div>
      {buttons.map((button) => (
        <PreviewAction
          key={button.id}
          icon={
            button.type === "PHONE_NUMBER" ? (
              <Phone className="h-4 w-4" weight="bold" />
            ) : button.type === "URL" ? (
              <Link className="h-4 w-4" weight="bold" />
            ) : button.type === "COPY_CODE" || button.type === "OTP" ? (
              <Copy className="h-4 w-4" weight="bold" />
            ) : button.type === "FLOW" ? (
              <ClipboardText className="h-4 w-4" weight="bold" />
            ) : undefined
          }
          label={button.type === "COPY_CODE" ? fallback.COPY_CODE : button.text || fallback[button.type] || button.type}
        />
      ))}
    </div>
  );
}

function CallPermissionPreview() {
  const t = useTranslations("whatsappTemplates.phonePreview");
  return (
    <div>
      <PreviewAction icon={<PhoneCall className="h-4 w-4" weight="bold" />} label={t("allowCall")} />
      <PreviewAction label={t("notNow")} />
    </div>
  );
}
