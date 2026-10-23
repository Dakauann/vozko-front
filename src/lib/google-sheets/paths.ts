export const GOOGLE_SHEETS_PATH = "/dashboard/integrations/google-sheets";

export function googleSheetPath(id: string): string {
  return `${GOOGLE_SHEETS_PATH}/${id}`;
}
