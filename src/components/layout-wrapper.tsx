"use client";

import Footer from "@/components/footer";
import Navbar from "@/components/elevated-design/navbar";
import { usePathname } from "next/navigation";

const CHROMELESS_ROUTES = ["/dashboard", "/print"];

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isChromeless = CHROMELESS_ROUTES.some((route) => {
    if (!pathname) return false;

    return (
      pathname === route ||
      pathname.startsWith(`${route}/`) ||
      new RegExp(`^/[a-z]{2}${route}(/|$)`).test(pathname)
    );
  });

  return (
    <>
      {!isChromeless && <Navbar />}
      {children}
      {!isChromeless && <Footer />}
    </>
  );
}
