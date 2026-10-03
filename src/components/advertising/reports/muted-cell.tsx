export function MutedCell({ value }: { value: string }) {
  return <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{value}</span>;
}
