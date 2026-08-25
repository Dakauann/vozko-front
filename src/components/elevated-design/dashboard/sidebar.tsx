"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { AnimatePresence, type Variants, motion } from "framer-motion";
import {
  Archive,
  Buildings,
  Check,
  CaretDown,
  ChatCircle,
  PlusCircle,
  ClipboardText,
  DeviceMobile,
  Files,
  SquaresFour,
  Sparkle,
  Package,
  Phone,
  PhoneCall,
  Waveform,
  Megaphone,
  Robot,
  Gear,
  GitBranch,
  Handshake,
  UserCircle,
  UsersFour,
  UserPlus,
  Wallet,
  LinkSimple,
  Plugs,
  PuzzlePiece,
  EnvelopeSimple,
  Headset,
  Tag,
  Leaf,
  CurrencyDollar,
  Receipt,
  Wrench,
  CalendarBlank,
  Lightning,
  GearSix,
  ChartBar,
  X,
} from "@/components/icons";
import type { Icon, IconProps } from "@/components/icons";
import type { ComponentType } from "react";

import {
  InstagramLogoColor,
  TelegramLogoColor,
  WhatsAppLogoColor,
} from "@/components/icons/channel-logos";

/**
 * Nav icons are Phosphor glyphs, except for the channel entries.
 *
 * WhatsApp and Instagram use their real brand marks: a channel in the nav is an
 * identity, and the green phone and the Instagram gradient are recognised before
 * the label is read. The brand components accept IconProps and ignore `weight`,
 * so they slot into the same call site.
 */
type NavIcon = Icon | ComponentType<IconProps>;

import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import {
  SPINE_WIDTH_OPEN,
  SPINE_WIDTH_RAIL,
  useSidebar,
} from "@/contexts/sidebar-context";
import { useTranslations } from "next-intl";
import { WorkspaceSwitcher } from "@/components/elevated-design/dashboard/workspace-switcher";
import { DepartmentSwitcher } from "@/components/elevated-design/dashboard/department-switcher";
import { useWorkspace } from "@/contexts/workspace-context";
import type { ResourceAction, ResourceType } from "@/lib/workspace/types";
import { getBrand } from "@/config/brand";

/** Which nav items (the per-row accordions) the operator left open. */
const OPEN_ITEMS_KEY = "dashboard-open-families";
/** Which section families (Atendimento, WhatsApp, …) the operator left open. */
const OPEN_FAMILIES_KEY = "dashboard-open-nav-families";

/**
 * useLayoutEffect on the client, useEffect on the server.
 *
 * The restore below has to land BEFORE the browser paints, or the spine paints
 * collapsed and then visibly jumps open. useLayoutEffect does exactly that, but
 * React warns when it runs during SSR, so it is swapped for the passive version
 * there (where it does nothing anyway).
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/**
 * A Set of open keys that survives a refresh, collapsed by default.
 *
 * Three things have to be true at once for this to feel stable, and each is a
 * separate mechanism:
 *
 * 1. NO HYDRATION MISMATCH. The initial value is an empty Set on the server AND
 *    on the client's first render, so the markup React hydrates against matches
 *    exactly. Reading localStorage in the useState initialiser would render open
 *    sections on the client against a collapsed server payload, which React
 *    reports as a hydration error and repairs by discarding the markup.
 *
 * 2. NO FLASH. The restore runs in a LAYOUT effect, which React flushes
 *    synchronously before the browser paints — so the first frame the operator
 *    sees is already the remembered shape, with no collapsed frame in between.
 *
 * 3. NO STUTTER. Restored sections must not replay their accordion. Callers gate
 *    the transition duration on `motionEnabled`, which flips one animation frame
 *    later, i.e. after that first paint.
 */
function usePersistentOpenSet(storageKey: string) {
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const didRestore = React.useRef(false);

  useIsomorphicLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setOpen(
            new Set(parsed.filter((k): k is string => typeof k === "string")),
          );
        }
      }
    } catch {
      // Private mode, quota, or corrupt JSON: collapsed is a fine fallback.
    }
    didRestore.current = true;
  }, [storageKey]);

  React.useEffect(() => {
    // Guarded so the empty initial Set can never overwrite stored state.
    if (!didRestore.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(open)));
    } catch {}
  }, [open, storageKey]);

  const toggle = React.useCallback((key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return [open, toggle] as const;
}

export type NavPermission = {
  resource: string;
  action?: string;
};

export interface NavItem {
  icon: NavIcon;
  labelKey: string;
  href: string;
  admin?: boolean;
  hideForAdmin?: boolean;
  children?: NavItem[];
  family?: string;
  /** Single required permission (legacy). */
  requiredPermission?: NavPermission;
  /** Show if the user has ANY of these permissions (e.g. metrics parent). */
  requiredAnyOf?: NavPermission[];
}

function navPermissionAllowed(
  item: Pick<NavItem, "requiredPermission" | "requiredAnyOf">,
  can: (resource: ResourceType, action: ResourceAction) => boolean,
  canAny: (resource: ResourceType) => boolean,
): boolean {
  if (item.requiredAnyOf && item.requiredAnyOf.length > 0) {
    return item.requiredAnyOf.some((p) =>
      p.action
        ? can(p.resource as ResourceType, p.action as ResourceAction)
        : canAny(p.resource as ResourceType),
    );
  }
  if (item.requiredPermission) {
    const { resource, action } = item.requiredPermission;
    return action
      ? can(resource as ResourceType, action as ResourceAction)
      : canAny(resource as ResourceType);
  }
  return true;
}

export interface Product {
  id: string;
  nameKey: string;
  icon: NavIcon;
  descriptionKey: string;
  navItems: NavItem[];
  requiredPermission?: {
    resource: string;
    action?: string;
  };
}

export interface DashboardSidebarProps {
  products: Product[];
  adminNavItems?: NavItem[];
  translationsNamespace?: string;
  className?: string;
}

export const campanhasNavItems: NavItem[] = [
  {
    icon: ChatCircle,
    labelKey: "nav.liveChat",
    href: "/dashboard/live-chat",
    family: "crm",
    requiredPermission: { resource: "conversations", action: "read" },
  },
  {
    icon: ChartBar,
    labelKey: "nav.metrics",
    href: "/dashboard/attendance",
    family: "crm",
    requiredPermission: { resource: "attendance", action: "read" },
    children: [
      {
        icon: ChartBar,
        labelKey: "nav.attendanceOps",
        href: "/dashboard/attendance",
        requiredPermission: { resource: "attendance", action: "read" },
      },
    ],
  },
  {
    icon: CurrencyDollar,
    labelKey: "nav.sales",
    href: "/dashboard/sales",
    family: "crm",
    requiredPermission: { resource: "conversations", action: "read" },
  },
  {
    icon: Sparkle,
    labelKey: "nav.aiChat",
    href: "/dashboard/ai-chat",
    family: "ai",
    requiredPermission: { resource: "ai_chat", action: "read" },
  },
  {
    icon: Robot,
    labelKey: "nav.agents",
    href: "/dashboard/agents",
    family: "ai",
    requiredPermission: { resource: "agents" },
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.agentsList",
        href: "/dashboard/agents",
        requiredPermission: { resource: "agents", action: "read" },
      },
      {
        icon: PlusCircle,
        labelKey: "nav.createAgent",
        href: "/dashboard/agents/new",
        requiredPermission: { resource: "agents", action: "create" },
      },
      {
        icon: Archive,
        labelKey: "nav.archivedAgents",
        href: "/dashboard/agents/archived",
        requiredPermission: { resource: "agents", action: "read" },
      },
      {
        icon: PuzzlePiece,
        labelKey: "nav.mcpServers",
        href: "/dashboard/agents/mcp",
        requiredPermission: { resource: "mcp", action: "read" },
      },
    ],
  },
  {
    icon: Files,
    labelKey: "nav.knowledgeBases",
    href: "/dashboard/knowledge-bases",
    family: "ai",
    requiredPermission: { resource: "agents", action: "read" },
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.knowledgeBasesList",
        href: "/dashboard/knowledge-bases",
        requiredPermission: { resource: "agents", action: "read" },
      },
      {
        icon: PlusCircle,
        labelKey: "nav.createKnowledgeBase",
        href: "/dashboard/knowledge-bases/new",
        requiredPermission: { resource: "agents", action: "create" },
      },
    ],
  },
  {
    icon: GitBranch,
    labelKey: "nav.workflows",
    href: "/dashboard/workflows",
    family: "ai",
    requiredPermission: { resource: "workflows" },
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.workflowsList",
        href: "/dashboard/workflows",
        requiredPermission: { resource: "workflows", action: "read" },
      },
      {
        icon: PlusCircle,
        labelKey: "nav.createWorkflow",
        href: "/dashboard/workflows/new",
        requiredPermission: { resource: "workflows", action: "create" },
      },
    ],
  },
  {
    icon: Megaphone,
    labelKey: "nav.whatsappCampaigns",
    href: "/dashboard/whatsapp-campaigns",
    family: "whatsapp",
    requiredPermission: { resource: "whatsapp_campaigns" },
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.whatsappCampaignsList",
        href: "/dashboard/whatsapp-campaigns",
        requiredPermission: { resource: "whatsapp_campaigns", action: "read" },
      },
      {
        icon: PlusCircle,
        labelKey: "nav.createWhatsappCampaign",
        href: "/dashboard/whatsapp-campaigns/new",
        requiredPermission: {
          resource: "whatsapp_campaigns",
          action: "create",
        },
      },
      {
        icon: Archive,
        labelKey: "nav.archivedWhatsappCampaigns",
        href: "/dashboard/whatsapp-campaigns/archived",
        requiredPermission: { resource: "whatsapp_campaigns", action: "read" },
      },
    ],
  },
  {
    icon: Leaf,
    labelKey: "nav.organicCampaigns",
    href: "/dashboard/whatsapp-campaigns/organic",
    family: "whatsapp",
    requiredPermission: { resource: "whatsapp_campaigns" },
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.organicCampaignsList",
        href: "/dashboard/whatsapp-campaigns/organic",
        requiredPermission: { resource: "whatsapp_campaigns", action: "read" },
      },
      {
        icon: PlusCircle,
        labelKey: "nav.createOrganicCampaign",
        href: "/dashboard/whatsapp-campaigns/new-organic",
        requiredPermission: {
          resource: "whatsapp_campaigns",
          action: "create",
        },
      },
    ],
  },
  {
    icon: Sparkle,
    labelKey: "nav.whatsappTemplates",
    href: "/dashboard/whatsapp-templates",
    family: "whatsapp",
    requiredPermission: { resource: "whatsapp_templates" },
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.whatsappTemplatesList",
        href: "/dashboard/whatsapp-templates",
        requiredPermission: { resource: "whatsapp_templates", action: "read" },
      },
      {
        icon: PlusCircle,
        labelKey: "nav.createWhatsappTemplate",
        href: "/dashboard/whatsapp-templates/new",
        requiredPermission: {
          resource: "whatsapp_templates",
          action: "create",
        },
      },
      {
        icon: GearSix,
        labelKey: "nav.manageAllTemplates",
        href: "/dashboard/whatsapp-templates/manage",
        admin: true,
      },
    ],
  },
  {
    icon: Lightning,
    labelKey: "nav.messageShortcuts",
    href: "/dashboard/message-shortcuts",
    family: "whatsapp",
    requiredPermission: { resource: "message_shortcuts", action: "read" },
  },
  {
    icon: UserCircle,
    labelKey: "nav.instagram",
    href: "/dashboard/instagram-accounts",
    family: "instagram",
    requiredPermission: { resource: "instagram_accounts" },
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.instagramAccounts",
        href: "/dashboard/instagram-accounts",
        requiredPermission: { resource: "instagram_accounts", action: "read" },
      },
      {
        icon: LinkSimple,
        labelKey: "nav.connectInstagram",
        href: "/dashboard/instagram-accounts/connect",
        requiredPermission: {
          resource: "instagram_accounts",
          action: "create",
        },
      },
    ],
  },
  {
    // The brand mark belongs to the FAMILY header (familyBrandIcon), which
    // already renders it beside "Telegram". Repeating it on the item showed the
    // logo twice in one group, Instagram uses a neutral glyph here for the
    // same reason.
    icon: UserCircle,
    labelKey: "nav.telegram",
    href: "/dashboard/telegram-accounts",
    family: "telegram",
    requiredPermission: { resource: "telegram_accounts" },
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.telegramAccounts",
        href: "/dashboard/telegram-accounts",
        requiredPermission: { resource: "telegram_accounts", action: "read" },
      },
      {
        icon: LinkSimple,
        labelKey: "nav.connectTelegram",
        href: "/dashboard/telegram-accounts/connect",
        requiredPermission: { resource: "telegram_accounts", action: "create" },
      },
    ],
  },
  {
    // The channel logo is deliberately NOT used here: the spine already carries
    // the official WhatsApp entry, and two identical marks in one group is how
    // an operator picks the wrong number to send from.
    icon: DeviceMobile,
    labelKey: "nav.unofficialWhatsapp",
    href: "/dashboard/unofficial-whatsapp",
    family: "unofficial-whatsapp",
    requiredPermission: { resource: "unofficial_whatsapp_instances" },
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.unofficialWhatsappNumbers",
        href: "/dashboard/unofficial-whatsapp",
        requiredPermission: {
          resource: "unofficial_whatsapp_instances",
          action: "read",
        },
      },
      {
        icon: LinkSimple,
        labelKey: "nav.connectUnofficialWhatsapp",
        href: "/dashboard/unofficial-whatsapp/connect",
        requiredPermission: {
          resource: "unofficial_whatsapp_instances",
          action: "create",
        },
      },
    ],
  },
  {
    icon: Phone,
    labelKey: "nav.whatsappBusinessPhones",
    href: "/dashboard/whatsapp-business-phones",
    family: "whatsapp",
    requiredPermission: { resource: "business_phones" },
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.whatsappBusinessPhonesList",
        href: "/dashboard/whatsapp-business-phones",
        requiredPermission: { resource: "business_phones", action: "read" },
      },
      {
        icon: LinkSimple,
        labelKey: "nav.connectWhatsappPhone",
        href: "/dashboard/whatsapp-business-phones/connect",
        requiredPermission: { resource: "business_phones", action: "create" },
      },
      {
        icon: GearSix,
        labelKey: "nav.manageAllPhones",
        href: "/dashboard/whatsapp-business-phones/manage",
        admin: true,
      },
    ],
  },
  // TODO: finish developing this section and add to layout
  {
    icon: Headset,
    labelKey: "nav.support",
    href: "/dashboard/issues",
    family: "management",
    requiredPermission: { resource: "issues" },
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.supportList",
        href: "/dashboard/issues",
        requiredPermission: { resource: "issues", action: "read" },
      },
      {
        icon: PlusCircle,
        labelKey: "nav.createSupport",
        href: "/dashboard/issues/new",
        requiredPermission: { resource: "issues", action: "create" },
      },
      {
        icon: Wrench,
        labelKey: "nav.manageSupport",
        href: "/dashboard/issues/manage",
        admin: true,
      },
    ],
  },
  {
    icon: Tag,
    labelKey: "nav.stageGroups",
    href: "/dashboard/stage-groups",
    family: "management",
    requiredPermission: { resource: "stage_groups", action: "read" },
  },
  {
    icon: UsersFour,
    labelKey: "nav.leads",
    href: "/dashboard/leads",
    family: "management",
    requiredPermission: { resource: "leads", action: "read" },
  },
  {
    icon: Package,
    labelKey: "nav.plans",
    href: "/dashboard/plans",
    family: "management",
    requiredPermission: { resource: "plans", action: "read" },
  },
  {
    icon: PuzzlePiece,
    labelKey: "nav.addons",
    href: "/dashboard/addons",
    family: "management",
    requiredPermission: { resource: "plans", action: "read" },
  },
  {
    icon: Wallet,
    labelKey: "nav.balance",
    href: "/dashboard/balance",
    family: "management",
    requiredPermission: { resource: "balance", action: "read" },
  },
  {
    icon: Receipt,
    labelKey: "nav.invoices",
    href: "/dashboard/invoices",
    family: "management",
    requiredPermission: { resource: "balance", action: "read" },
  },
  {
    icon: CalendarBlank,
    labelKey: "nav.calendar",
    href: "/dashboard/calendar",
    family: "management",
    requiredPermission: { resource: "calendar", action: "read" },
  },
  {
    icon: Plugs,
    labelKey: "nav.integrations",
    href: "/dashboard/integrations",
    family: "management",
    requiredPermission: { resource: "calendar", action: "read" },
  },
  {
    icon: LinkSimple,
    labelKey: "nav.links",
    href: "/dashboard/links",
    family: "management",
    requiredPermission: { resource: "short_links", action: "read" },
  },

  {
    icon: Buildings,
    labelKey: "nav.workspace",
    href: "/dashboard/workspace",
    family: "management",
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.workspaceSettings",
        href: "/dashboard/workspace",
      },
      {
        icon: EnvelopeSimple,
        labelKey: "nav.workspaceInvites",
        href: "/dashboard/workspace/invites",
      },
    ],
  },
];

export const adminNavItems: NavItem[] = [
  {
    icon: ChartBar,
    labelKey: "nav.adminOverview",
    href: "/dashboard/admin",
    admin: true,
    family: "platform",
  },
  {
    icon: UsersFour,
    labelKey: "nav.platformUsers",
    href: "/dashboard/users",
    admin: true,
    family: "platform",
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.usersList",
        href: "/dashboard/users",
      },
      {
        icon: UserPlus,
        labelKey: "nav.registerUser",
        href: "/dashboard/users/register",
      },
    ],
  },
  {
    icon: Buildings,
    labelKey: "nav.platformWorkspaces",
    href: "/dashboard/workspaces",
    admin: true,
    family: "platform",
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.workspacesList",
        href: "/dashboard/workspaces",
      },
    ],
  },
  {
    icon: Package,
    labelKey: "nav.managePlans",
    href: "/dashboard/plans/manage",
    admin: true,
    family: "platform",
  },
  {
    icon: PuzzlePiece,
    labelKey: "nav.manageAddons",
    href: "/dashboard/addons/manage",
    admin: true,
    family: "platform",
  },
  {
    icon: Handshake,
    labelKey: "nav.adminAffiliates",
    href: "/dashboard/admin/affiliates",
    admin: true,
    family: "platform",
  },
  {
    icon: CurrencyDollar,
    labelKey: "nav.platformPricing",
    href: "/dashboard/pricing",
    admin: true,
    family: "platform",
  },
  {
    icon: Gear,
    labelKey: "nav.systemConfig",
    href: "/dashboard/admin/system-config",
    admin: true,
    family: "platform",
  },
];

export const affiliateNavItems: NavItem[] = [
  {
    icon: Handshake,
    labelKey: "nav.affiliate",
    href: "/dashboard/affiliate",
    family: "management",
    requiredPermission: { resource: "affiliate", action: "use" },
    children: [
      {
        icon: SquaresFour,
        labelKey: "nav.affiliateDashboard",
        href: "/dashboard/affiliate",
        requiredPermission: { resource: "affiliate", action: "use" },
      },
      {
        icon: UsersFour,
        labelKey: "nav.affiliateReferrals",
        href: "/dashboard/affiliate/referrals",
        requiredPermission: { resource: "affiliate", action: "use" },
      },
      {
        icon: CurrencyDollar,
        labelKey: "nav.affiliateEarnings",
        href: "/dashboard/affiliate/earnings",
        requiredPermission: { resource: "affiliate", action: "use" },
      },
      {
        icon: Package,
        labelKey: "nav.affiliatePlans",
        href: "/dashboard/affiliate/plans",
        requiredPermission: { resource: "affiliate", action: "use" },
      },
    ],
  },
];

export const defaultProducts: Product[] = [
  {
    id: "campanhas",
    nameKey: "products.campaigns.name",
    icon: Megaphone,
    descriptionKey: "products.campaigns.description",
    navItems: campanhasNavItems,
  },
  {
    id: "affiliate",
    nameKey: "products.affiliate.name",
    icon: Handshake,
    descriptionKey: "products.affiliate.description",
    navItems: affiliateNavItems,
    requiredPermission: { resource: "affiliate", action: "use" },
  },
];

function ProductSwitcher({
  currentProduct,
  onProductChange,
  isExpanded,
  t,
  products,
}: {
  currentProduct: Product;
  onProductChange: (product: Product) => void;
  isExpanded: boolean;
  t: ReturnType<typeof useTranslations>;
  products: Product[];
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const Icon = currentProduct.icon;
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = React.useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  React.useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, 232);
      setMenuPos({
        top: r.bottom + 4,
        left: Math.min(r.left, window.innerWidth - width - 8),
        width,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [isOpen]);

  /** The spine is overflow-hidden; the menu has to live outside it. */
  const menuRef = React.useRef<HTMLDivElement>(null);
  const renderMenu = (body: React.ReactNode) =>
    typeof document !== "undefined" && isOpen && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
            className="rounded-lg z-[100] border border-border bg-popover p-1 shadow-2xl"
          >
            {body}
          </div>,
          document.body,
        )
      : null;

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // The menu is PORTALED to document.body, so it is never inside
      // dropdownRef — it must be checked separately or this mousedown
      // handler unmounts the menu before a row's click can fire, which is
      // exactly the bug that made product rows unclickable.
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        !(menuRef.current && menuRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // The rail form: a square tile, lit only while its menu is open. No accent
  // fill at rest — in this system the accent means "current", and the product
  // switcher is a control, not a destination.
  if (!isExpanded) {
    return (
      <div ref={dropdownRef} className="relative">
        <button
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-[--radius] border transition-colors",
            isOpen
              ? "border-border bg-muted text-foreground"
              : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="h-[18px] w-[18px]" weight="regular" />
        </button>
        {renderMenu(
          <>
            {products.map((product) => {
              const ProductIcon = product.icon;
              const isSelected = product.id === currentProduct.id;
              return (
                <button
                  key={product.id}
                  onClick={() => {
                    onProductChange(product);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors",
                    isSelected
                      ? "bg-primary-subtle text-primary-ink"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span
                    className={cn("lamp", !isSelected && "opacity-0")}
                    aria-hidden="true"
                  />
                  <ProductIcon className="h-4 w-4 shrink-0" weight="regular" />
                  <span
                    className={cn(
                      "flex-1 truncate text-sm",
                      isSelected && "font-semibold",
                    )}
                  >
                    {t(product.nameKey)}
                  </span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 shrink-0" weight="bold" />
                  )}
                </button>
              );
            })}
          </>,
        )}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-[--radius] border px-2 text-left transition-colors",
          isOpen
            ? "border-border bg-muted"
            : "border-transparent hover:bg-muted",
        )}
      >
        <Icon
          className="h-[18px] w-[18px] shrink-0 text-muted-foreground"
          weight="regular"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {t(currentProduct.nameKey)}
        </span>
        <CaretDown
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
          weight="bold"
        />
      </button>

      {renderMenu(
        <>
          {products.map((product) => {
            const ProductIcon = product.icon;
            const isSelected = product.id === currentProduct.id;
            return (
              <button
                key={product.id}
                onClick={() => {
                  onProductChange(product);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-2 text-left transition-colors",
                  isSelected ? "bg-primary-subtle" : "hover:bg-muted",
                )}
              >
                <span
                  className={cn("lamp", !isSelected && "opacity-0")}
                  aria-hidden="true"
                />
                <ProductIcon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isSelected ? "text-foreground" : "text-muted-foreground",
                  )}
                  weight="regular"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm text-foreground",
                      isSelected && "font-semibold",
                    )}
                  >
                    {t(product.nameKey)}
                  </span>
                  <span className="block truncate text-2xs text-muted-foreground">
                    {t(product.descriptionKey)}
                  </span>
                </span>
                {isSelected && (
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-foreground"
                    weight="bold"
                  />
                )}
              </button>
            );
          })}
        </>,
      )}
    </div>
  );
}

/**
 * The mobile drawer slides, because a drawer arriving from offscreen is
 * reporting where it came from. The desktop spine does not: it is furniture and
 * it is simply there on load. The old staggered spring entrance made every
 * navigation feel like the app was booting.
 */
const mobileContainerVariants: Variants = {
  hidden: { x: "-100%" },
  visible: {
    x: 0,
    transition: { duration: 0.16, ease: [0.2, 0, 0, 1] },
  },
  exit: {
    x: "-100%",
    transition: { duration: 0.12, ease: [0.2, 0, 0, 1] },
  },
};

function NavItemComponent({
  item,
  isExpanded,
  depth = 0,
  onToggle,
  openItems,
  motionEnabled,
  t,
  isAdmin = false,
  can,
  canAny,
  parentFamily,
}: {
  item: NavItem;
  isExpanded: boolean;
  depth?: number;
  onToggle: (href: string) => void;
  openItems: Set<string>;
  /** False for the paint that restores remembered families, so they appear
      instantly instead of replaying their accordion on every refresh. */
  motionEnabled: boolean;
  t: ReturnType<typeof useTranslations>;
  isAdmin?: boolean;
  can: (resource: ResourceType, action: ResourceAction) => boolean;
  canAny: (resource: ResourceType) => boolean;
  parentFamily?: string;
}) {
  const pathname = usePathname();
  const isOpen = openItems.has(item.href);
  const isActive =
    pathname === item.href ||
    (item.children &&
      item.href !== "/dashboard" &&
      item.href !== "/" &&
      pathname?.startsWith(item.href + "/"));
  const hasActiveChild = item.children?.some(
    (child) =>
      pathname === child.href || pathname?.startsWith(child.href + "/"),
  );
  /*
    Auto-opening the family that contains the current route is deliberately
    gone. It fought the remembered state on every single load: a family the
    operator had collapsed on purpose sprang back open the moment they
    navigated into it, so the spine could never actually stay the shape they
    left it in.

    Orientation does not depend on it — a family whose child is active still
    lights its own row through `hasActiveChild`, so "you are in here" is
    readable with the family shut.
  */

  const handleClick = (e: React.MouseEvent) => {
    if (item.children && isExpanded) {
      e.preventDefault();
      onToggle(item.href);
    }
  };
  const effectiveFamily = item.family ?? parentFamily;
  const isLit = Boolean(isActive || hasActiveChild);

  return (
    <div className="w-full">
      <Link
        // gets the first clickable item, normally list
        href={item.href}
        prefetch={false}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "sidebar-item group relative flex items-center rounded-[--radius] text-sm transition-colors",
          isExpanded ? "h-8 w-full pr-2" : "h-8 w-full justify-center",
          // The selected-item treatment from the reference system: a tinted
          // ground in the brand hue, the label in brand ink, and the rounded
          // accent bar on the leading edge. Three signals at once, so it never
          // rests on colour alone — a grey fill alone (what this used to be)
          // was indistinguishable from hover two rows away.
          // Selected and hover were BOTH `bg-muted` — the same grey — so the
          // current page was indistinguishable from whatever row the pointer
          // happened to rest on. Selected now takes the tinted brand ground
          // and brand ink the reference system uses, which leaves plain grey
          // free to mean hover and nothing else.
          isLit
            ? "bg-primary-subtle text-primary-ink"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        onClick={handleClick}
      >
        {isExpanded ? (
          <>
            <span
              className={cn("lamp ml-1 mr-1.5", !isLit && "opacity-0")}
              aria-hidden="true"
            />
            <span
              className="flex min-w-0 flex-1 items-center gap-2"
              style={{
                paddingLeft: depth > 0 ? `${depth * 0.625}rem` : undefined,
              }}
            >
              {React.createElement(item.icon, {
                className: cn("size-4 shrink-0"),
                weight: "regular",
              })}

              <span
                className={cn(
                  "min-w-0 flex-1 truncate leading-tight",
                  depth > 0 && "text-xs",
                  isLit && "font-semibold",
                )}
              >
                {t(item.labelKey)}
              </span>

              {item.children && (
                <CaretDown
                  className={cn(
                    "h-3 w-3 shrink-0 opacity-60 transition-transform",
                    isOpen && "rotate-180",
                  )}
                  weight="bold"
                />
              )}
            </span>
          </>
        ) : (
          <span className="relative flex h-8 w-full items-center justify-center">
            {/* In the rail the lamp sits on the spine edge, where the row's
                left border would be, so "current" is still readable with the
                label hidden. */}
            <span
              className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2",
                "lamp",
                !isLit && "opacity-0",
              )}
              aria-hidden="true"
            />
            {React.createElement(item.icon, {
              className: "size-4 shrink-0",
              weight: "regular",
            })}
          </span>
        )}
      </Link>

      <AnimatePresence initial={false}>
        {item.children && isOpen && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: motionEnabled ? 0.2 : 0,
              ease: [0.1, 0.9, 0.2, 1],
            }}
            className="overflow-hidden"
          >
            {/* An engraved runner, not a coloured rail: children hang off the
                parent's column the way a sub-scale hangs off a panel legend. */}
            <div className="my-0.5 ml-[18px] space-y-px border-l border-border pl-1.5">
              {item.children
                .filter((child) => {
                  if (child.admin && !isAdmin) return false;
                  if (child.hideForAdmin && isAdmin) return false;
                  return navPermissionAllowed(child, can, canAny);
                })
                .map((child, index) => (
                  <NavItemComponent
                    key={index}
                    item={child}
                    isExpanded={isExpanded}
                    depth={depth + 1}
                    onToggle={onToggle}
                    openItems={openItems}
                    motionEnabled={motionEnabled}
                    t={t}
                    isAdmin={isAdmin}
                    can={can}
                    canAny={canAny}
                    parentFamily={effectiveFamily}
                  />
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Family identity is carried by the engraved section rule and its silkscreened
// legend, not by a coloured dot per family. Six decorative hues competing down
// the spine cost more than they told you, and colour in this system is reserved
// for state — a palette of family dots makes "lit" harder to find.
//
// Channel families are the exception and keep their real brand mark (see
// familyBrandIcon): that is product identity, not decoration.

/**
 * A qualifier shown beside a family name.
 *
 * WhatsApp is the only family where WHICH integration you are looking at
 * matters: the current one is Meta's official Cloud API, and unofficial
 * providers are planned alongside it. Marking the official one now means the
 * distinction is already visible when the second appears, rather than an
 * unlabelled "WhatsApp" suddenly becoming ambiguous.
 *
 * A chip rather than a longer label: the family header is a 10px uppercase
 * line, and "WhatsApp Oficial" would push it toward wrapping in the narrower
 * locales.
 */
const familyBadgeKey: Record<string, string> = {
  whatsapp: "families.badges.official",
  // The counterpart this map was built for. Two WhatsApp families now sit next
  // to each other in the spine, and the badge is the ONLY thing that separates
  // them at a glance — an operator picking the wrong one sends from the wrong
  // number, under the wrong rules, with a different risk profile.
  "unofficial-whatsapp": "families.badges.unofficial",
};

const familyBrandIcon: Record<string, NavIcon> = {
  whatsapp: WhatsAppLogoColor,
  // It IS WhatsApp, so it carries the WhatsApp mark: swapping in a generic
  // glyph would hide which channel this is. The badge, not the icon, is what
  // distinguishes the transport.
  "unofficial-whatsapp": WhatsAppLogoColor,
  instagram: InstagramLogoColor,
  telegram: TelegramLogoColor,
};

function groupByFamily(
  items: NavItem[],
): { family: string | undefined; items: NavItem[] }[] {
  const groups: { family: string | undefined; items: NavItem[] }[] = [];
  const familyIndex = new Map<string | undefined, number>();

  for (const item of items) {
    const key = item.family;
    if (familyIndex.has(key)) {
      groups[familyIndex.get(key)!].items.push(item);
    } else {
      familyIndex.set(key, groups.length);
      groups.push({ family: key, items: [item] });
    }
  }

  return groups;
}

function GroupedNavItems({
  items,
  isExpanded,
  onToggle,
  openItems,
  openFamilies,
  toggleFamily,
  motionEnabled,
  t,
  isAdmin,
  can,
  canAny,
}: {
  items: NavItem[];
  isExpanded: boolean;
  onToggle: (href: string) => void;
  openItems: Set<string>;
  /** Section families the operator has opened; everything else stays shut. */
  openFamilies: Set<string>;
  toggleFamily: (family: string) => void;
  motionEnabled: boolean;
  t: ReturnType<typeof useTranslations>;
  isAdmin: boolean;
  can: (resource: ResourceType, action: ResourceAction) => boolean;
  canAny: (resource: ResourceType) => boolean;
}) {
  const filtered = items.filter((item) => {
    if (item.hideForAdmin && isAdmin) {
      return false;
    }
    return navPermissionAllowed(item, can, canAny);
  });

  const groups = groupByFamily(filtered);

  return (
    <div className={cn("py-1", isExpanded ? "px-2" : "px-1.5")}>
      {groups.map((group, gi) => {
        // A family only collapses where its header exists. In the rail there is
        // no header to click, and an ungrouped run has no family to belong to,
        // so both stay open — otherwise the operator would be left with rows
        // they cannot reach and no control to reveal them.
        const collapsible = Boolean(group.family) && isExpanded;
        const familyOpen = collapsible
          ? openFamilies.has(group.family as string)
          : true;

        return (
          <div key={group.family ?? `ungrouped-${gi}`}>
            {/*
              The section legend rides its engraved rule, the way a console
              legends the bank of strips beneath it. In the rail there is no
              room for the words, so the rule alone keeps the grouping.
            */}
            {group.family && isExpanded && (
              <div className={cn("px-1 pb-1 pt-3", gi > 0 && "mt-1")}>
                {/*
                  The section legend is the control that opens the section. It
                  keeps the rule it rides on, so the grouping still reads at a
                  glance when every family is shut — which is the default.
                */}
                <button
                  type="button"
                  onClick={() => toggleFamily(group.family as string)}
                  aria-expanded={familyOpen}
                  className="legend group/family flex w-full items-center gap-1.5 rounded-[--radius] px-1 py-0.5 text-left transition-colors hover:!text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {familyBrandIcon[group.family] &&
                    React.createElement(familyBrandIcon[group.family], {
                      className: "h-3 w-3 flex-shrink-0",
                    })}
                  {/* min-w-0 is what makes `truncate` actually shrink inside a
                      flex row. Without it the name holds its full width and a
                      longer badge than "Oficial" — "Não oficial", "Inoffiziell" —
                      overlaps it instead of ellipsing the name. */}
                  <span className="min-w-0 truncate">
                    {t(`families.${group.family}`)}
                  </span>
                  {familyBadgeKey[group.family] && (
                    <span
                      // The hint is derived from the badge key rather than
                      // hardcoded, or every badge explains the OFFICIAL channel
                      // — which on the unofficial one is exactly backwards.
                      title={t(`${familyBadgeKey[group.family]}Hint`)}
                      className="rounded-lg shrink-0 border border-border px-1 py-px text-2xs font-medium normal-case tracking-normal text-muted-foreground"
                    >
                      {t(familyBadgeKey[group.family])}
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className="ml-0.5 h-px flex-1 bg-border"
                  />
                  <CaretDown
                    aria-hidden="true"
                    weight="bold"
                    className={cn(
                      "h-3 w-3 flex-shrink-0 opacity-50 transition-transform",
                      motionEnabled ? "duration-150" : "duration-0",
                      familyOpen && "rotate-180",
                    )}
                  />
                </button>
              </div>
            )}
            {(!group.family || !isExpanded) && gi > 0 && (
              <div className="my-1.5 h-px bg-border" />
            )}
            <AnimatePresence initial={false}>
              {familyOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    duration: motionEnabled ? 0.2 : 0,
                    ease: [0.1, 0.9, 0.2, 1],
                  }}
                  className="overflow-hidden"
                >
                  <div className="space-y-px">
                    {group.items.map((item, index) => (
                      <NavItemComponent
                        key={index}
                        item={item}
                        isExpanded={isExpanded}
                        onToggle={onToggle}
                        openItems={openItems}
                        motionEnabled={motionEnabled}
                        t={t}
                        isAdmin={isAdmin}
                        can={can}
                        canAny={canAny}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardSidebar({
  products,
  adminNavItems: adminItems = [],
  translationsNamespace = "sidebar",
  className,
}: DashboardSidebarProps) {
  const t = useTranslations(translationsNamespace);
  const pathname = usePathname();
  const { user } = useAuth();
  const { can, canAny } = useWorkspace();
  const isAdmin = user?.role === "admin";

  const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebar();

  // Open unless the operator collapsed it. Hover no longer expands anything:
  // navigation that appears on approach cannot be scanned, only hunted, and
  // this rail is read continuously for a whole shift. The collapse control is
  // the app bar's hamburger; the drawer state lives in the sidebar context so
  // the same hamburger opens it below md.
  const isExpanded = !isCollapsed;

  // Soft navigation must close the mobile drawer; otherwise the veil and drawer
  // panel stay painted over the next route (reported as a blackout).
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const visibleProducts = React.useMemo(() => {
    return products.filter((p) => {
      if (!p.requiredPermission) return true;
      const { resource, action } = p.requiredPermission;
      return action
        ? can(resource as ResourceType, action as ResourceAction)
        : canAny(resource as ResourceType);
    });
  }, [products, can, canAny]);

  const pendingRestoreId = React.useRef<string | null>(
    typeof window !== "undefined"
      ? localStorage.getItem("dashboard-selected-product")
      : null,
  );

  const [currentProduct, setCurrentProduct] = React.useState<Product>(
    visibleProducts[0] ?? products[0],
  );

  React.useEffect(() => {
    if (!pendingRestoreId.current) return;
    const saved = visibleProducts.find(
      (p) => p.id === pendingRestoreId.current,
    );
    if (saved) {
      setCurrentProduct(saved);
      pendingRestoreId.current = null;
    }
  }, [visibleProducts]);

  React.useEffect(() => {
    try {
      localStorage.setItem("dashboard-selected-product", currentProduct.id);
    } catch {}
  }, [currentProduct]);

  React.useEffect(() => {
    if (!visibleProducts.find((p) => p.id === currentProduct.id)) {
      if (visibleProducts[0]) setCurrentProduct(visibleProducts[0]);
    }
  }, [visibleProducts, currentProduct.id]);

  // Both the per-row accordions and the section families are collapsed by
  // default and remember what the operator left open. See usePersistentOpenSet.
  const [openItems, toggleItem] = usePersistentOpenSet(OPEN_ITEMS_KEY);
  const [openFamilies, toggleFamily] = usePersistentOpenSet(OPEN_FAMILIES_KEY);
  const [motionEnabled, setMotionEnabled] = React.useState(false);

  React.useEffect(() => {
    const id = requestAnimationFrame(() => setMotionEnabled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleProductSwitch = (product: Product) => {
    setCurrentProduct(product);
  };

  // No head anymore: brand and workspace moved into the full-width app bar,
  // which owns the corner in the Azure topology. The rail starts below the bar
  // and opens directly with the product switcher and the nav.
  const renderSidebarContent = (mobile = false) => (
    <>
      <div
        className={cn(
          "flex-shrink-0 border-b border-border",
          mobile ? "px-2 py-2" : isExpanded ? "px-2 py-2" : "px-1.5 py-2",
        )}
      >
        <ProductSwitcher
          currentProduct={currentProduct}
          onProductChange={handleProductSwitch}
          isExpanded={isExpanded || mobile}
          t={t}
          products={visibleProducts}
        />
      </div>

      {/* Scrollable container for both product nav and admin nav */}
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <GroupedNavItems
          items={currentProduct.navItems}
          isExpanded={isExpanded || mobile}
          onToggle={toggleItem}
          openItems={openItems}
          openFamilies={openFamilies}
          toggleFamily={toggleFamily}
          motionEnabled={motionEnabled}
          t={t}
          isAdmin={isAdmin}
          can={can}
          canAny={canAny}
        />

        {isAdmin && adminItems.length > 0 && (
          <>
            {(isExpanded || mobile) && (
              <div className="mt-2 border-t border-border px-3 pb-1 pt-3">
                <span className="legend">{t("admin.title")}</span>
              </div>
            )}
            <GroupedNavItems
              items={adminItems}
              isExpanded={isExpanded || mobile}
              onToggle={toggleItem}
              openItems={openItems}
              openFamilies={openFamilies}
              toggleFamily={toggleFamily}
              motionEnabled={motionEnabled}
              t={t}
              isAdmin={isAdmin}
              can={can}
              canAny={canAny}
            />
          </>
        )}
      </div>
    </>
  );

  const MobileSidebar = (
    <div className="md:hidden">
      {/* The drawer opens from the app bar's hamburger — the same affordance
          that collapses the rail on desktop. The old mid-screen edge tab is
          gone: its function relocated to the bar, its floating chrome retired. */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              onClick={() => setMobileOpen(false)}
            />

            <motion.div
              variants={mobileContainerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-y-0 left-0 z-50 flex w-[min(288px,88vw)] flex-col border-r border-sidebar-border bg-sidebar shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label={t("openMenu")}
            >
              <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border px-3">
                <span className="truncate text-sm font-semibold text-foreground">
                  {getBrand().name}
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={t("closeMenu")}
                >
                  <X className="h-4 w-4" weight="bold" />
                </button>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-2 border-b border-border px-2 py-2">
                <WorkspaceSwitcher fullWidth />
                <DepartmentSwitcher fullWidth />
              </div>
              <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col overflow-y-auto">
                {renderSidebarContent(true)}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      {MobileSidebar}

      {/*
        The rail starts BELOW the full-width app bar — the Azure topology. The
        bar owns the corner and carries brand + workspace; the rail carries
        only navigation, so it opens directly with the product switcher. Its
        collapse control is the bar's hamburger, so the rail needs no footer.
      */}
      <motion.aside
        initial={false}
        animate={{ width: isExpanded ? SPINE_WIDTH_OPEN : SPINE_WIDTH_RAIL }}
        transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
        suppressHydrationWarning
        className={cn(
          "fixed bottom-0 left-0 top-12 z-30 hidden flex-shrink-0",
          "overflow-hidden border-r border-sidebar-border bg-sidebar md:flex",
          className,
        )}
      >
        <div className="flex h-full w-full flex-col">
          {renderSidebarContent()}
        </div>
      </motion.aside>
    </>
  );
}
