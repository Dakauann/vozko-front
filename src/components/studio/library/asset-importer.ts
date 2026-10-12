"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

import { isActionError } from "@/app/actions/action-result";
import { importLibraryAssetAction } from "@/app/actions/studio-library";
import { setAssetImporter, type AssetImporter } from "@/lib/studio/library/asset-import";
import { libraryLocale } from "@/lib/studio/library/catalog";

export function browserAssetImporter(locale: string, load: typeof fetch = fetch): AssetImporter {
  return async (itemId, asset) => {
    const response = await load(`/${asset.path}`);
    if (!response.ok) throw new Error(`the library picture ${itemId} could not be read`);
    const result = await importLibraryAssetAction(itemId, await response.blob(), libraryLocale(locale));
    if (isActionError(result)) throw new Error(result.error);
    return result.data.mediaId;
  };
}

export function useLibraryAssetImport(): void {
  const locale = useLocale();
  useEffect(() => setAssetImporter(browserAssetImporter(locale)), [locale]);
}
