type Translate = (key: string) => string;

export function mapLibreLocale(t: Translate): Record<string, string> {
  return {
    "Map.Title": t("mapLabel"),
    "Marker.Title": t("controls.marker"),
    "NavigationControl.ZoomIn": t("controls.zoomIn"),
    "NavigationControl.ZoomOut": t("controls.zoomOut"),
    "NavigationControl.ResetBearing": t("controls.resetBearing"),
    "AttributionControl.ToggleAttribution": t("controls.attribution"),
  };
}
