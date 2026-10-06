export function PanelHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
