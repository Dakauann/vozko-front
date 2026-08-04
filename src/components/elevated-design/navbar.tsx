"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Stack,
  SquaresFour,
  SignOut,
  List,
  User,
  X,
} from "@/components/icons";
import { useEffect, useState } from "react";

import Button from "./button";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { UserDropdown } from "./user-dropdown";
import { useAuth } from "@/contexts/auth-context";
import { usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/language-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "next-themes";

import { BrandLogo } from "@/components/brand-logo";

const BrandMark = ({
  useWhite,
}: {
  className?: string;
  useWhite?: boolean;
}) => <BrandLogo useWhite={useWhite} size="lg" hideTextOnMobile />;

// Public marketing pages (about / how-it-works / contact / pricing) were removed.
// The top bar is now a clean sign-in surface with no marketing navigation.

const DARK_ON_TOP_ROUTES: string[] = [];

export default function Navbar() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("navbar");
  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const shouldUseScrollTone = DARK_ON_TOP_ROUTES.includes(pathname);
  const [isScrolled, setIsScrolled] = useState(!shouldUseScrollTone);
  const showDarkNavigation = shouldUseScrollTone && !isScrolled;

  const handleLogout = async () => {
    try {
      await logout();

      setIsMobileMenuOpen(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    if (!shouldUseScrollTone) {
      return;
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [shouldUseScrollTone]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  const menuVariants = {
    closed: {
      opacity: 0,
      x: "100%",
      transition: {
        type: "spring" as const,
        stiffness: 400,
        damping: 40,
      },
    },
    open: {
      opacity: 1,
      x: "0%",
      transition: {
        type: "spring" as const,
        stiffness: 400,
        damping: 40,
      },
    },
  };

  const overlayVariants = {
    closed: {
      opacity: 0,
      transition: {
        duration: 0.2,
      },
    },
    open: {
      opacity: 1,
      transition: {
        duration: 0.2,
      },
    },
  };

  const menuItemVariants = {
    closed: {
      opacity: 0,
      x: 50,
    },
    open: {
      opacity: 1,
      x: 0,
    },
  };

  const staggerContainer = {
    open: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
    closed: {
      transition: {
        staggerChildren: 0.05,
        staggerDirection: -1 as const,
      },
    },
  };

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 80,
          damping: 14,
          mass: 0.7,
          duration: 0.6,
        }}
        className={cn(
          "fixed top-0 right-0 left-0 z-50 border-b transition-colors duration-300",
          showDarkNavigation
            ? "border-white/10 bg-black text-white"
            : "border-border bg-card text-foreground",
        )}
      >
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark useWhite={showDarkNavigation || isDark} />
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            <LanguageSwitcher
              tone={showDarkNavigation ? "dark" : "light"}
              size="sm"
            />
            <span
              aria-hidden
              className={cn(
                "mx-1.5 h-6 w-px",
                showDarkNavigation ? "bg-white/15" : "bg-border",
              )}
            />
            {isLoading ? (
              <div className="h-8 w-24 animate-pulse rounded-[--radius] bg-muted" />
            ) : isAuthenticated && user ? (
              <UserDropdown
                user={user}
                onLogout={handleLogout}
                tone={showDarkNavigation ? "dark" : "light"}
              />
            ) : (
              <Button
                variant="primary"
                title={t("login")}
                icon={<User className="h-[18px] w-[18px]" weight="fill" />}
                iconVisible
                iconSide="left"
                link="/login"
                newTab={false}
                className="px-4"
              />
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={cn(
                "rounded-[--radius] p-2 transition-colors",
                showDarkNavigation ? "hover:bg-white/10" : "hover:bg-muted",
              )}
              aria-label="Menu"
            >
              <motion.div
                animate={{ rotate: isMobileMenuOpen ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                {isMobileMenuOpen ? (
                  <X
                    className={cn(
                      "h-6 w-6",
                      showDarkNavigation ? "text-white" : "text-foreground",
                    )}
                    weight="bold"
                  />
                ) : (
                  <List
                    className={cn(
                      "h-6 w-6",
                      showDarkNavigation ? "text-white" : "text-foreground",
                    )}
                    weight="bold"
                  />
                )}
              </motion.div>
            </button>
          </div>
        </div>
      </motion.nav>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              variants={overlayVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={closeMobileMenu}
            />

            <motion.div
              variants={menuVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="fixed top-0 right-0 z-50 h-full w-80 max-w-[85vw] border-l border-border bg-card shadow-2xl md:hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <Link
                  href="/"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-3"
                >
                  <BrandMark useWhite={isDark} />
                </Link>
                <button
                  onClick={closeMobileMenu}
                  className="rounded-full p-2 transition-colors hover:bg-muted"
                  aria-label="Fechar menu"
                >
                  <X className="h-6 w-6 text-foreground" weight="bold" />
                </button>
              </div>

              <motion.div
                variants={staggerContainer}
                initial="closed"
                animate="open"
                exit="closed"
                className="flex flex-col p-4 space-y-2"
              >
                {isLoading ? (
                  <motion.div variants={menuItemVariants}>
                    <div className="h-12 bg-border animate-pulse rounded-lg w-full" />
                  </motion.div>
                ) : (
                  <>
                    {isAuthenticated && user ? (
                      <>
                        <motion.div variants={menuItemVariants}>
                          <div className="rounded-[--radius] bg-muted px-4 py-4">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-border shadow-md ring-2 ring-blue-500/20">
                                <Image
                                  src={
                                    user.picture
                                      ? user.picture
                                      : `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(
                                          user.name || user.email,
                                        )}&backgroundColor=e0f2fe,bfdbfe,dbeafe&radius=50&scale=80`
                                  }
                                  alt={user.name || user.email}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">
                                  {user.name || user.email.split("@")[0]}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {user.email.split("@")[0]}
                                </p>
                              </div>
                            </div>
                            {user.role === "admin" && (
                              <span className="inline-flex items-center rounded-[--radius] bg-black px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                                {t("adminBadge")}
                              </span>
                            )}
                          </div>
                        </motion.div>

                        {user.role === "admin" && (
                          <motion.div variants={menuItemVariants}>
                            <Link
                              href="/dashboard"
                              onClick={closeMobileMenu}
                              className="flex items-center gap-3 rounded-[--radius] px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted"
                            >
                              <SquaresFour
                                className="h-5 w-5 text-muted-foreground"
                                weight="fill"
                              />
                              <span>{t("dashboard")}</span>
                            </Link>
                          </motion.div>
                        )}

                        <motion.div variants={menuItemVariants}>
                          <Link
                            href="/perfil"
                            onClick={closeMobileMenu}
                            className="flex items-center gap-3 rounded-[--radius] px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted"
                          >
                            <User
                              className="h-5 w-5 text-muted-foreground"
                              weight="fill"
                            />
                            <span>{t("account")}</span>
                          </Link>
                        </motion.div>

                        <motion.div variants={menuItemVariants}>
                          <Button
                            variant="secondary-cta"
                            title={t("logout")}
                            icon={<SignOut className="h-5 w-5" weight="bold" />}
                            iconVisible={true}
                            iconSide="left"
                            onClick={handleLogout}
                            className="w-full"
                          />
                        </motion.div>
                      </>
                    ) : (
                      <motion.div
                        variants={menuItemVariants}
                        onClick={closeMobileMenu}
                      >
                        <Button
                          variant="ghost"
                          title={t("login")}
                          icon={<User className="h-5 w-5" weight="fill" />}
                          iconVisible={true}
                          iconSide="left"
                          link="/login"
                          newTab={false}
                          className="w-full"
                        />
                      </motion.div>
                    )}
                  </>
                )}

                <motion.div variants={menuItemVariants} className="py-2">
                  <div className="border-t border-border"></div>
                </motion.div>

                <motion.div variants={menuItemVariants} className="pt-2">
                  <div className="rounded-lg bg-muted px-4 py-3">
                    <h4 className="mb-2 font-semibold text-foreground">
                      {t("support_title")}
                    </h4>
                    <p className="mb-2 text-sm text-muted-foreground">
                      {t("support_description")}
                    </p>
                    <div className="space-y-1 text-sm text-foreground">
                      <p>{t("support_email")}</p>
                      <p>{t("support_phone")}</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div variants={menuItemVariants} className="pt-2">
                  <LanguageSwitcher />
                </motion.div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
