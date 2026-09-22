"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { AnimatePresence, type Variants, motion } from "framer-motion";
import {
  Archive,
  ArrowsInSimple,
  ArrowsOut,
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
  Bell,
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
  Scales,
  Wrench,
  CalendarBlank,
  Lightning,
  GearSix,
  Kanban,
  ChartBar,
  UsersThree,
  X,
} from "@/components/icons";
import type { Icon, IconProps } from "@/components/icons";
import type { ComponentType } from "react";

import {
  InstagramLogoColor,
  TelegramLogoColor,
  WhatsAppLogoColor,
} from "@/components/icons/channel-logos";

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

const OPEN_ITEMS_KEY = "dashboard-open-families";
const OPEN_FAMILIES_KEY = "dashboard-open-nav-families";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

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
    }
    didRestore.current = true;
  }, [storageKey]);

  React.useEffect(() => {
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

  const setMany = React.useCallback((keys: string[], shouldOpen: boolean) => {
    if (keys.length === 0) return;
    setOpen((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (shouldOpen) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }, []);

  return [open, toggle, setMany] as const;
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
  requiredPermission?: NavPermission;
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
    icon: Kanban,
    labelKey: "nav.funnels",
    href: "/dashboard/funnels",
    family: "crm",
    requiredPermission: { resource: "stages", action: "read" },
  },
  {
    icon: ChartBar,
    labelKey: "nav.metrics",
    href: "/dashboard/attendance",
    family: "crm",
    requiredAnyOf: [
      { resource: "attendance", action: "read" },
      { resource: "audience", action: "read" },
      { resource: "audience", action: "send" },
    ],
    children: [
      {
        icon: ChartBar,
        labelKey: "nav.attendanceOps",
        href: "/dashboard/attendance",
        requiredPermission: { resource: "attendance", action: "read" },
      },
      {
        icon: UsersThree,
        labelKey: "nav.audience",
        href: "/dashboard/audience",
        requiredPermission: { resource: "audience", action: "read" },
      },
      {
        icon: Bell,
        labelKey: "nav.analysisAlerts",
        href: "/dashboard/analysis-alerts",
        requiredPermission: { resource: "audience", action: "send" },
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
    icon: Megaphone,
    labelKey: "nav.unofficialWhatsappCampaigns",
    href: "/dashboard/unofficial-whatsapp-campaigns",
    family: "unofficial-whatsapp",
    requiredPermission: { resource: "unofficial_whatsapp_campaigns" },
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.unofficialWhatsappCampaignsList",
        href: "/dashboard/unofficial-whatsapp-campaigns",
        requiredPermission: {
          resource: "unofficial_whatsapp_campaigns",
          action: "read",
        },
      },
      {
        icon: PlusCircle,
        labelKey: "nav.createUnofficialWhatsappCampaign",
        href: "/dashboard/unofficial-whatsapp-campaigns/new",
        requiredPermission: {
          resource: "unofficial_whatsapp_campaigns",
          action: "create",
        },
      },
      {
        icon: Archive,
        labelKey: "nav.archivedUnofficialWhatsappCampaigns",
        href: "/dashboard/unofficial-whatsapp-campaigns/archived",
        requiredPermission: {
          resource: "unofficial_whatsapp_campaigns",
          action: "read",
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
    icon: Scales,
    labelKey: "nav.adminMetaCosts",
    href: "/dashboard/admin/meta-costs",
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
                      ? "bg-muted text-foreground"
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
                    <Check
                      className="h-3.5 w-3.5 shrink-0 text-primary-ink"
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
                  isSelected ? "bg-muted" : "hover:bg-muted",
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
                    className="h-3.5 w-3.5 shrink-0 text-primary-ink"
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
        href={item.href}
        prefetch={false}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "sidebar-item group relative flex items-center rounded-[--radius] text-sm transition-colors",
          isExpanded ? "h-8 w-full pr-2" : "h-8 w-full justify-center",
          isLit
            ? "bg-primary text-primary-foreground shadow-button-primary hover:bg-[hsl(var(--primary-hover))]"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        onClick={handleClick}
      >
        {isExpanded ? (
          <>
            <span
              className={cn(
                "lamp ml-1 mr-1.5",
                isLit ? "lamp-on-fill" : "opacity-0",
              )}
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
            {
}
            <span
              className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2",
                "lamp",
                isLit ? "lamp-on-fill" : "opacity-0",
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
            {
}
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


const familyBadgeKey: Record<string, string> = {
  whatsapp: "families.badges.official",
  "unofficial-whatsapp": "families.badges.unofficial",
};

const familyBrandIcon: Record<string, NavIcon> = {
  whatsapp: WhatsAppLogoColor,
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

function collapsibleKeys(
  items: NavItem[],
  isAdmin: boolean,
  can: (resource: ResourceType, action: ResourceAction) => boolean,
  canAny: (resource: ResourceType) => boolean,
): { families: string[]; rows: string[] } {
  const families = new Set<string>();
  const rows: string[] = [];

  const walkChildren = (children: NavItem[]) => {
    for (const child of children) {
      if (child.admin && !isAdmin) continue;
      if (child.hideForAdmin && isAdmin) continue;
      if (!navPermissionAllowed(child, can, canAny)) continue;
      if (child.children?.length) {
        rows.push(child.href);
        walkChildren(child.children);
      }
    }
  };

  for (const item of items) {
    if (item.hideForAdmin && isAdmin) continue;
    if (!navPermissionAllowed(item, can, canAny)) continue;
    if (item.family) families.add(item.family);
    if (item.children?.length) {
      rows.push(item.href);
      walkChildren(item.children);
    }
  }

  return { families: Array.from(families), rows };
}

function FoldAllButton({
  anyOpen,
  onFoldAll,
  onUnfoldAll,
  t,
}: {
  anyOpen: boolean;
  onFoldAll: () => void;
  onUnfoldAll: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const label = anyOpen ? t("foldAll") : t("unfoldAll");
  const Icon = anyOpen ? ArrowsInSimple : ArrowsOut;

  return (
    <button
      type="button"
      onClick={anyOpen ? onFoldAll : onUnfoldAll}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] border border-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon aria-hidden="true" className="h-4 w-4" weight="bold" />
    </button>
  );
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
        const collapsible = Boolean(group.family) && isExpanded;
        const familyOpen = collapsible
          ? openFamilies.has(group.family as string)
          : true;

        return (
          <div key={group.family ?? `ungrouped-${gi}`}>
            {
}
            {group.family && isExpanded && (
              <div className={cn("px-1 pb-1 pt-3", gi > 0 && "mt-1")}>
                {
}
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
                  {
}
                  <span className="min-w-0 truncate">
                    {t(`families.${group.family}`)}
                  </span>
                  {familyBadgeKey[group.family] && (
                    <span
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

  const isExpanded = !isCollapsed;

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

  const [openItems, toggleItem, setItemsOpen] =
    usePersistentOpenSet(OPEN_ITEMS_KEY);
  const [openFamilies, toggleFamily, setFamiliesOpen] =
    usePersistentOpenSet(OPEN_FAMILIES_KEY);

  const foldable = React.useMemo(
    () =>
      collapsibleKeys(
        [...currentProduct.navItems, ...(isAdmin ? adminItems : [])],
        isAdmin,
        can,
        canAny,
      ),
    [currentProduct, adminItems, isAdmin, can, canAny],
  );

  const anyOpen =
    foldable.families.some((family) => openFamilies.has(family)) ||
    foldable.rows.some((href) => openItems.has(href));

  const setAllOpen = React.useCallback(
    (shouldOpen: boolean) => {
      setFamiliesOpen(foldable.families, shouldOpen);
      setItemsOpen(foldable.rows, shouldOpen);
    },
    [foldable, setFamiliesOpen, setItemsOpen],
  );

  const [motionEnabled, setMotionEnabled] = React.useState(false);

  React.useEffect(() => {
    const id = requestAnimationFrame(() => setMotionEnabled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleProductSwitch = (product: Product) => {
    setCurrentProduct(product);
  };

  const renderSidebarContent = (mobile = false) => (
    <>
      <div
        className={cn(
          "flex-shrink-0 border-b border-border",
          mobile ? "px-2 py-2" : isExpanded ? "px-2 py-2" : "px-1.5 py-2",
        )}
      >
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <ProductSwitcher
              currentProduct={currentProduct}
              onProductChange={handleProductSwitch}
              isExpanded={isExpanded || mobile}
              t={t}
              products={visibleProducts}
            />
          </div>
          {
}
          {(isExpanded || mobile) &&
            foldable.families.length + foldable.rows.length > 0 && (
              <FoldAllButton
                anyOpen={anyOpen}
                onFoldAll={() => setAllOpen(false)}
                onUnfoldAll={() => setAllOpen(true)}
                t={t}
              />
            )}
        </div>
      </div>

      {}
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
      {
}
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

      {
}
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
