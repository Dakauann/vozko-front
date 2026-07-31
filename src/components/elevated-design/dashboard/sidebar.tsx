"use client";

import * as React from "react";

import { AnimatePresence, type Variants, motion } from "framer-motion";
import {
  Archive,
  Buildings,
  Check,
  CaretDown,
  ChatCircle,
  PlusCircle,
  PushPin,
  ClipboardText,
  Files,
  SquaresFour,
  List as ListIcon,
  Sparkle,
  Package,
  InstagramLogo,
  Phone,
  PhoneCall,
  PhoneIncoming,
  Waveform,
  WhatsappLogo,
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
} from "@phosphor-icons/react";
import type { Icon, IconProps } from "@phosphor-icons/react";
import type { ComponentType } from "react";

import { InstagramLogoColor, WhatsAppLogoColor } from "@/components/icons/channel-logos";

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
import { useSidebar } from "@/contexts/sidebar-context";
import { useTranslations } from "next-intl";
import { WorkspaceSwitcher } from "@/components/elevated-design/dashboard/workspace-switcher";
import { DepartmentSwitcher } from "@/components/elevated-design/dashboard/department-switcher";
import { useWorkspace } from "@/contexts/workspace-context";
import type { ResourceAction, ResourceType } from "@/lib/workspace/types";
import { getBrand } from "@/config/brand";

const specialRouteAnimation = `@keyframes gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

@keyframes sparkle {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(0.9);
  }
}
`;

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
  special?: "ai" | "new" | "premium";
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
    // Both service and telephony metrics dashboards use attendance:read.
    requiredPermission: { resource: "attendance", action: "read" },
    children: [
      {
        icon: ChartBar,
        labelKey: "nav.attendanceOps",
        href: "/dashboard/attendance",
        requiredPermission: { resource: "attendance", action: "read" },
      },
      {
        icon: PhoneCall,
        labelKey: "nav.telephony",
        href: "/dashboard/telephony",
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
    special: "new",
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
        requiredPermission: { resource: "instagram_accounts", action: "create" },
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
    icon: Waveform,
    labelKey: "nav.recordings",
    href: "/dashboard/recordings",
    family: "voip",
    requiredPermission: { resource: "call_recordings", action: "read" },
  },
  {
    icon: PhoneCall,
    labelKey: "nav.calls",
    href: "/dashboard/calls",
    family: "voip",
    requiredPermission: { resource: "call_recordings", action: "read" },
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
    icon: PhoneCall,
    labelKey: "nav.sipTrunks",
    href: "/dashboard/sip-trunks",
    family: "voip",
    requiredPermission: { resource: "sip_trunks" },
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.sipTrunksList",
        href: "/dashboard/sip-trunks",
      },
      {
        icon: PlusCircle,
        labelKey: "nav.createSipTrunk",
        href: "/dashboard/sip-trunks/new",
        requiredPermission: { resource: "sip_trunks", action: "create" },
      },
    ],
  },
  {
    icon: Headset,
    labelKey: "nav.branches",
    href: "/dashboard/branches",
    family: "voip",
    requiredPermission: { resource: "branches" },
    children: [
      {
        icon: ClipboardText,
        labelKey: "nav.branchesList",
        href: "/dashboard/branches",
      },
      {
        icon: PlusCircle,
        labelKey: "nav.createBranch",
        href: "/dashboard/branches/new",
        requiredPermission: { resource: "branches", action: "create" },
      },
    ],
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
    icon: PhoneCall,
    labelKey: "nav.adminSipTrunks",
    href: "/dashboard/admin/sip-trunks",
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

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
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
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-white shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 active:scale-95"
        >
          <Icon className="h-5 w-5" weight="fill" />
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, x: -8, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute left-full top-0 z-50 ml-2 w-56 rounded-xl border border-border/80 bg-card p-1.5 shadow-xl shadow-black/10"
            >
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
                      "flex w-full items-center gap-3 rounded-lg p-2.5 transition-all",
                      isSelected ? "bg-primary/10" : "hover:bg-muted",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        isSelected
                          ? "bg-primary text-white"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <ProductIcon className="h-4 w-4" weight="fill" />
                    </div>
                    <div className="flex-1 text-left">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          isSelected ? "text-primary" : "text-foreground",
                        )}
                      >
                        {t(product.nameKey)}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary" weight="bold" />
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl p-3 transition-all",
          "bg-gradient-to-br from-muted to-card",
          "border border-border/80 shadow-sm",
          "hover:border-primary/40 hover:shadow-md hover:shadow-primary/5",
          isOpen && "border-primary/40 shadow-md shadow-primary/5",
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-white shadow-md shadow-primary/20">
          <Icon className="h-5 w-5" weight="fill" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {t(currentProduct.nameKey)}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {t(currentProduct.descriptionKey)}
          </p>
        </div>
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
            isOpen ? "bg-primary/10" : "bg-muted",
          )}
        >
          <CaretDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isOpen ? "rotate-180 text-primary" : "text-muted-foreground",
            )}
          />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-border/80 bg-card p-1.5 shadow-xl shadow-black/10"
          >
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
                    "flex w-full items-center gap-3 rounded-lg p-3 transition-all",
                    isSelected
                      ? "bg-gradient-to-br from-primary/10 to-primary/5"
                      : "hover:bg-muted",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                      isSelected
                        ? "bg-gradient-to-br from-primary to-primary/80 text-white shadow-md shadow-primary/20"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <ProductIcon className="h-4.5 w-4.5" weight="fill" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p
                      className={cn(
                        "text-sm font-semibold truncate",
                        isSelected ? "text-primary" : "text-foreground",
                      )}
                    >
                      {t(product.nameKey)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t(product.descriptionKey)}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                      <Check
                        className="h-3.5 w-3.5 text-primary"
                        weight="bold"
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const SpecialBadge = ({ type }: { type: NavItem["special"] }) => {
  if (!type) return null;

  switch (type) {
    case "ai":
      return (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 via-cyan-500 to-blue-500 opacity-70 blur-[2px] animate-[pulse_2s_ease-in-out_infinite]"></div>
            <div className="relative flex items-center justify-center rounded-full bg-gradient-to-r from-blue-400 via-cyan-500 to-blue-500 p-1 text-white animate-[gradient_3s_ease_infinite] bg-[length:200%_200%]">
              <Sparkle
                className="h-3 w-3 animate-[sparkle_2s_ease-in-out_infinite]"
                weight="fill"
              />
            </div>
          </div>
        </div>
      );
    case "new":
      return (
        <div className="absolute right-2 bottom-0 translate-y-full px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-500 text-white animate-[float_2s_ease-in-out_infinite]">
          Novo
        </div>
      );
    case "premium":
      return (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500 text-white animate-[pulse_2s_ease-in-out_infinite]">
          Premium
        </div>
      );
    default:
      return null;
  }
};

const containerVariants: Variants = {
  hidden: {
    x: -300,
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
      duration: 0.6,
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const mobileContainerVariants = {
  hidden: {
    x: -300,
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      stiffness: 120,
      damping: 20,
      duration: 0.5,
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
  exit: {
    x: -300,
    opacity: 0,
    transition: {
      duration: 0.3,
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

function NavItemComponent({
  item,
  isExpanded,
  depth = 0,
  onToggle,
  openItems,
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
  const didAutoOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (hasActiveChild && !isOpen && !didAutoOpenRef.current) {
      onToggle(item.href);
      didAutoOpenRef.current = true;
    }
  }, [hasActiveChild, isOpen, onToggle, item.href]);

  const handleClick = (e: React.MouseEvent) => {
    if (item.children) {
      e.preventDefault();
      onToggle(item.href);
    }
  };

  const isAiItem = item.special === "ai";
  const effectiveFamily = item.family ?? parentFamily;

  return (
    <div className="w-full">
      <Link
        href={item.href}
        prefetch={false}
        className={cn(
          "sidebar-item relative flex items-center border border-transparent text-sm transition-all group",
          isExpanded
            ? "h-9 w-full rounded-lg px-2.5"
            : "h-9 w-full justify-center rounded-lg px-2",
          isActive || hasActiveChild
            ? "border-primary/20 bg-primary/10 text-primary"
            : "text-foreground hover:bg-muted/60",
          isAiItem && isExpanded && "pr-7",
        )}
        onClick={handleClick}
      >
        {isAiItem && (
          <div className="absolute inset-0 bg-gradient-to-r from-purple-400/10 via-pink-500/10 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        )}

        {isExpanded ? (
          <div
            className={cn(
              "flex w-full items-center gap-2.5",
              depth > 0 && "pl-4",
            )}
            style={{
              paddingLeft: depth > 0 ? `${depth * 0.625}rem` : undefined,
            }}
          >
            <div
              className={cn(
                "relative flex-shrink-0",
                isAiItem && "animate-[float_3s_ease-in-out_infinite]",
              )}
            >
              {isAiItem && (
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 rounded-full opacity-20 blur-[8px]"></div>
              )}
              {React.createElement(item.icon, {
                className: cn(
                  depth === 0 ? "h-[18px] w-[18px]" : "h-4 w-4",
                  "shrink-0",
                  isAiItem && "relative z-10",
                ),
                weight: "fill",
              })}
            </div>

            <span
              className={cn(
                "flex-1 min-w-0 truncate leading-tight",
                depth === 0 ? "text-sm" : "text-[13px]",
                isActive || hasActiveChild ? "font-semibold" : "font-medium",
              )}
            >
              {t(item.labelKey)}
            </span>

            {item.special && (
              <div className="flex-shrink-0">
                <SpecialBadge type={item.special} />
              </div>
            )}

            {item.children && (
              <div className="flex-shrink-0">
                <CaretDown
                  className={cn(
                    "h-3 w-3 transition-transform duration-200 opacity-60",
                    isOpen && "rotate-180",
                  )}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex w-full items-center justify-center flex-shrink-0">
            <div
              className={cn(
                "relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
                isActive || hasActiveChild
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted/60",
                isAiItem && "animate-[float_3s_ease-in-out_infinite]",
              )}
            >
              {isAiItem && (
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 opacity-20 blur-[4px] -z-10 scale-90"></div>
              )}
              {React.createElement(item.icon, {
                className: cn(
                  "h-[18px] w-[18px] shrink-0",
                  isAiItem && "relative z-10",
                ),
                weight: "fill",
              })}
            </div>
          </div>
        )}

        {(isActive || hasActiveChild) && (
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            className={cn(
              "absolute left-0 inset-y-0 my-auto w-[3px] h-5 rounded-r-full origin-center",
              isAiItem
                ? "bg-gradient-to-b from-purple-400 via-pink-500 to-red-500"
                : "bg-primary",
            )}
          />
        )}
      </Link>

      <AnimatePresence initial={false}>
        {item.children && isOpen && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              duration: 0.15,
              ease: "easeOut",
            }}
            className="overflow-hidden pl-2"
          >
            <div
              className={cn(
                "ml-[14px] border-l pl-1.5 my-0.5 space-y-px",
                item.special === "ai"
                  ? "border-purple-300/40"
                  : "border-border/50",
              )}
            >
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

// Icons stay neutral (monochrome) per the design rules; family identity is carried
// by a small dot beside the group label instead of coloring the glyph — except
// channel families, whose header carries the small brand mark instead.
const familyDotColor: Record<string, string> = {
  whatsapp: "bg-emerald-500",
  ai: "bg-violet-500",
  voip: "bg-sky-500",
  management: "bg-slate-400",
  support: "bg-rose-500",
  crm: "bg-indigo-500",
};

const familyBrandIcon: Record<string, NavIcon> = {
  whatsapp: WhatsAppLogoColor,
  instagram: InstagramLogoColor,
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
  t,
  isAdmin,
  can,
  canAny,
}: {
  items: NavItem[];
  isExpanded: boolean;
  onToggle: (href: string) => void;
  openItems: Set<string>;
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
    <div className="px-2 py-1.5">
      {groups.map((group, gi) => {
        return (
          <div key={group.family ?? `ungrouped-${gi}`}>
            {group.family && isExpanded && (
              <div
                className={cn(
                  "px-1 pt-3 pb-1.5",
                  gi > 0 && "mt-1 border-t border-border/40",
                )}
              >
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {familyBrandIcon[group.family] ? (
                    React.createElement(familyBrandIcon[group.family], {
                      className: "h-3 w-3 flex-shrink-0",
                    })
                  ) : (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 flex-shrink-0 rounded-full",
                        familyDotColor[group.family] ?? "bg-muted-foreground/40",
                      )}
                    />
                  )}
                  {t(`families.${group.family}`)}
                </span>
              </div>
            )}
            {!group.family && gi > 0 && isExpanded && (
              <div className="mt-1 border-t border-border/40 pt-1" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item, index) => (
                <NavItemComponent
                  key={index}
                  item={item}
                  isExpanded={isExpanded}
                  onToggle={onToggle}
                  openItems={openItems}
                  t={t}
                  isAdmin={isAdmin}
                  can={can}
                  canAny={canAny}
                />
              ))}
            </div>
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

  React.useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.textContent = specialRouteAnimation;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const { isPinned, togglePin } = useSidebar();
  const [isHovered, setIsHovered] = React.useState(false);
  const [hasMounted, setHasMounted] = React.useState(false);
  const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  const isExpanded = hasMounted && (isPinned || isHovered);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [openItems, setOpenItems] = React.useState<Set<string>>(new Set());

  // Soft navigation must close the mobile drawer; otherwise the bg-black veil
  // and drawer panel stay painted over the next route (reported as blackout).
  React.useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

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

  const toggleItem = React.useCallback((href: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      return next;
    });
  }, []);

  const handleMouseEnter = React.useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleMouseLeave = React.useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 300);
  }, []);

  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleProductSwitch = (product: Product) => {
    setCurrentProduct(product);
  };

  const renderSidebarContent = (mobile = false) => (
    <>
      {/* Product Switcher */}
      <div className={cn("px-2 flex-shrink-0", mobile ? "pt-2" : "pt-3")}>
        <ProductSwitcher
          currentProduct={currentProduct}
          onProductChange={handleProductSwitch}
          isExpanded={isExpanded || mobile}
          t={t}
          products={visibleProducts}
        />
      </div>

      {/* Scrollable container for both product nav and admin nav */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-sleek">
        <GroupedNavItems
          items={currentProduct.navItems}
          isExpanded={isExpanded || mobile}
          onToggle={toggleItem}
          openItems={openItems}
          t={t}
          isAdmin={isAdmin}
          can={can}
          canAny={canAny}
        />

        {isAdmin && adminItems.length > 0 && (
          <>
            {(isExpanded || mobile) && (
              <div className="px-4 pt-4 pb-2 border-t border-border/70 mt-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("admin.title")}
                </span>
              </div>
            )}
            <GroupedNavItems
              items={adminItems}
              isExpanded={isExpanded || mobile}
              onToggle={toggleItem}
              openItems={openItems}
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
      {/* Collapsed edge tab (same language as PersistentDialer): slim, out of the way. */}
      {!isMobileOpen ? (
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          aria-label={t("openMenu")}
          className={cn(
            "fixed left-0 top-1/2 z-50 -translate-y-1/2",
            "flex flex-col items-center justify-center gap-2 px-1.5 py-3",
            "rounded-r-xl border border-l-0 border-border/80 bg-card/95 shadow-lg backdrop-blur-sm",
            "transition-colors hover:bg-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
          )}
        >
          <ListIcon
            className="h-3.5 w-3.5 text-muted-foreground"
            weight="bold"
          />
          <span
            className="text-[10px] font-semibold tracking-wide text-muted-foreground"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          >
            {t("panel")}
          </span>
        </button>
      ) : null}

      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
            />

            <motion.div
              variants={mobileContainerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-y-0 left-0 z-50 flex w-[min(300px,88vw)] flex-col bg-card shadow-2xl shadow-black/20"
              role="dialog"
              aria-modal="true"
              aria-label={t("openMenu")}
            >
              <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border/70 px-3">
                <span className="truncate text-sm font-semibold text-foreground">
                  {getBrand().name}
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={t("closeMenu")}
                >
                  <X className="h-4 w-4" weight="bold" />
                </button>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-2 border-b border-border/70 px-3 py-3">
                <WorkspaceSwitcher fullWidth />
                <DepartmentSwitcher fullWidth />
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-sleek">
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

      <motion.aside
        variants={containerVariants}
        initial="hidden"
        animate={{
          width: isExpanded ? 264 : 60,
          opacity: 1,
          x: 0,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
          duration: 0.3,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        suppressHydrationWarning
        className={cn(
          "fixed top-20 left-0 hidden h-[calc(100vh-5rem)] flex-shrink-0 overflow-hidden border-r border-border/80 bg-card/80 backdrop-blur-xl md:flex transition-shadow duration-300",
          isPinned ? "z-30" : "z-40",
          !isPinned &&
            isExpanded &&
            "shadow-2xl shadow-black/10 border-r-border/60",
          className,
        )}
      >
        <div className="flex h-full w-full flex-col">
          {renderSidebarContent()}

          {/* Pin/anchor button - at bottom of sidebar */}
          <div className="flex-shrink-0 border-t border-border/70 px-2 py-2">
            <button
              onClick={togglePin}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2 h-9 transition-colors",
                hasMounted && isPinned
                  ? "bg-primary/10 text-primary hover:bg-primary/15"
                  : "text-foreground hover:bg-muted/60",
                !isExpanded && "justify-center",
              )}
              title={
                hasMounted && isPinned ? "Desafixar sidebar" : "Fixar sidebar"
              }
            >
              <PushPin
                className={cn(
                  "h-[18px] w-[18px] flex-shrink-0 transition-transform duration-200",
                  !(hasMounted && isPinned) && "-rotate-45",
                )}
                weight="fill"
              />
              {isExpanded && (
                <span className="text-sm font-medium truncate">
                  {isPinned ? "Desafixar" : "Fixar"}
                </span>
              )}
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
