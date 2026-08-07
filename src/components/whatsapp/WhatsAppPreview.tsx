"use client";

import {
  CheckCircle,
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

interface WhatsAppPreviewProps {
  components: DraggableComponent[];
  templateName?: string;
  language?: string;
}

export default function WhatsAppPreview({
  components,
  templateName = "Untitled Template",
  language = "en",
}: WhatsAppPreviewProps) {
  const headerComponent = components.find((c) => c.type === "HEADER");
  const bodyComponent = components.find((c) => c.type === "BODY");
  const footerComponent = components.find((c) => c.type === "FOOTER");
  const buttonsComponent = components.find((c) => c.type === "BUTTONS");
  const callPermissionComponent = components.find(
    (c) => c.type === "CALL_PERMISSION_REQUEST",
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 rounded-t-3xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">V</span>
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-sm">{getBrand().name}</h3>
            <p className="text-healthy-ink text-xs">
              Typically replies instantly
            </p>
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
          <div className="inline-block bg-card px-3 py-1.5 rounded-full">
            <p className="text-[11px] text-muted-foreground font-medium">
              Template: {templateName} ({language.toUpperCase()})
            </p>
          </div>
        </div>

        {components.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-card rounded-2xl p-6 max-w-xs">
              <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                <CheckCircle
                  className="h-6 w-6 text-muted-foreground"
                  weight="duotone"
                />
              </div>
              <p className="text-xs text-muted-foreground font-medium mb-1">
                No components yet
              </p>
              <p className="text-xs text-muted-foreground">
                Add components to see the preview
              </p>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-sm"
          >
            <div className="bg-card rounded-xl shadow-sm overflow-hidden">
              {headerComponent && <HeaderPreview component={headerComponent} />}

              <div className="px-4 py-3">
                {bodyComponent ? (
                  <BodyPreview component={bodyComponent} />
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Add a body component to see message text
                  </p>
                )}

                {footerComponent && footerComponent.data.text && (
                  <FooterPreview component={footerComponent} />
                )}
              </div>

              {buttonsComponent?.data?.buttons &&
                buttonsComponent.data.buttons.length > 0 && (
                  <ButtonsPreview component={buttonsComponent} />
                )}

              {callPermissionComponent && <CallPermissionPreview />}
            </div>

            <div className="flex justify-end mt-1 px-1">
              <span className="text-[11px] text-muted-foreground">
                {new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function HeaderPreview({ component }: { component: DraggableComponent }) {
  const { format, text, example } = component.data;

  if (format === "TEXT") {
    return (
      <div className="px-4 pt-4 pb-2">
        <p className="text-sm font-semibold text-foreground">
          {text || <span className="text-muted-foreground italic">Header text</span>}
        </p>
      </div>
    );
  }

  if (format === "IMAGE") {
    return (
      <div className="aspect-video bg-muted flex items-center justify-center border-b border-border relative">
        {example ? (
          // unoptimized: the header media is a user-supplied URL of any host, so it
          // is not in next.config images.remotePatterns, routing it through the
          // /_next/image optimizer 400s. Serve it directly instead.
          <Image src={example} alt="Header" fill className="object-cover" unoptimized />
        ) : (
          <div className="text-center">
            <ImageIcon
              className="h-12 w-12 text-slate-300 mx-auto mb-2"
              weight="duotone"
            />
            <p className="text-xs text-muted-foreground">Image header</p>
          </div>
        )}
      </div>
    );
  }

  if (format === "VIDEO") {
    return (
      <div className="aspect-video bg-muted flex items-center justify-center border-b border-border">
        {example ? (
          <video src={example} controls className="w-full h-full" />
        ) : (
          <div className="text-center">
            <VideoCamera
              className="h-12 w-12 text-slate-300 mx-auto mb-2"
              weight="duotone"
            />
            <p className="text-xs text-muted-foreground">Video header</p>
          </div>
        )}
      </div>
    );
  }

  if (format === "DOCUMENT") {
    return (
      <div className="px-4 pt-4 pb-2 border-b border-border">
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <div className="h-10 w-10 rounded-lg tile-brand flex items-center justify-center flex-shrink-0">
            <FileIcon className="h-5 w-5 text-primary-ink" weight="duotone" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              Document.pdf
            </p>
            <p className="text-xs text-muted-foreground">PDF • 1.2 MB</p>
          </div>
        </div>
      </div>
    );
  }

  if (format === "LOCATION") {
    return (
      <div className="aspect-video bg-muted flex items-center justify-center border-b border-border relative">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-teal-100" />
        <div className="relative text-center">
          <MapPin
            className="h-12 w-12 text-healthy-ink mx-auto mb-2"
            weight="duotone"
          />
          <p className="text-xs font-medium text-foreground">
            {component.data.locationName || "Location"}
          </p>
          <p className="text-xs text-muted-foreground">
            {component.data.locationAddress || "Address"}
          </p>
        </div>
      </div>
    );
  }

  if (format === "GIF") {
    return (
      <div className="aspect-video bg-muted flex items-center justify-center border-b border-border relative">
        {example ? (
          // unoptimized: user-supplied URL of any host, see the IMAGE header note.
          <Image src={example} alt="GIF" fill className="object-cover" unoptimized />
        ) : (
          <div className="text-center">
            <Gif
              className="h-12 w-12 text-slate-300 mx-auto mb-2"
              weight="duotone"
            />
            <p className="text-xs text-muted-foreground">GIF header</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function BodyPreview({ component }: { component: DraggableComponent }) {
  const { text } = component.data;

  if (!text) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Add message text to the body component
      </p>
    );
  }

  const renderText = text
    .replace(/\{\{1\}\}/g, "John")
    .replace(/\{\{2\}\}/g, "Smith")
    .replace(/\{\{3\}\}/g, "Premium")
    .replace(/\{\{name\}\}/gi, "John")
    .replace(/\{\{lastname\}\}/gi, "Smith")
    .replace(/\{\{product\}\}/gi, "Premium");

  return (
    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
      {renderText}
    </p>
  );
}

function FooterPreview({ component }: { component: DraggableComponent }) {
  return (
    <p className="text-xs text-muted-foreground mt-2 italic">{component.data.text}</p>
  );
}

function ButtonsPreview({ component }: { component: DraggableComponent }) {
  const buttons = component.data.buttons || [];

  return (
    <div className="border-t border-border">
      {buttons.map((button, index: number) => (
        <motion.button
          key={button.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.05 }}
          className={`w-full px-4 py-3 text-center text-sm font-medium text-primary-ink hover:bg-muted transition-colors ${
            index !== buttons.length - 1 ? "border-b border-border" : ""
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            {button.type === "PHONE_NUMBER" && (
              <Phone className="h-4 w-4" weight="bold" />
            )}
            {button.type === "URL" && (
              <Link className="h-4 w-4" weight="bold" />
            )}
            {button.type === "COPY_CODE" && (
              <Copy className="h-4 w-4" weight="bold" />
            )}
            <span>
              {button.type === "QUICK_REPLY" && (button.text || "Quick Reply")}
              {button.type === "URL" && (button.text || "Visit Website")}
              {button.type === "PHONE_NUMBER" && (button.text || "Call Us")}
              {button.type === "COPY_CODE" && "Copy Offer Code"}
            </span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}

function CallPermissionPreview() {
  // WhatsApp renders these accept/decline buttons automatically and controls
  // their exact wording per the user's locale. This is a representative preview.
  const buttons = [
    { label: "Allow call", icon: true },
    { label: "Not now", icon: false },
  ];

  return (
    <div className="border-t border-border">
      {buttons.map((button, index) => (
        <motion.button
          key={button.label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.05 }}
          className={`w-full px-4 py-3 text-center text-sm font-medium text-primary-ink hover:bg-muted transition-colors ${
            index !== buttons.length - 1 ? "border-b border-border" : ""
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            {button.icon && <PhoneCall className="h-4 w-4" weight="bold" />}
            <span>{button.label}</span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
