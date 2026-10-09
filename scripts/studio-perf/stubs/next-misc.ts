import { createElement, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";

export default function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return createElement("a", props);
}

export function Image(props: ImgHTMLAttributes<HTMLImageElement>) {
  return createElement("img", props);
}

export function useRouter() {
  return { push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined, prefetch: () => undefined };
}

export function usePathname() {
  return "/pt/dashboard/studio/image/perf";
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return { locale: "pt" };
}

export function redirect() {
  return undefined;
}

export function notFound() {
  return undefined;
}
