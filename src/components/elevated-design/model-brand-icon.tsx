"use client";

import type { ComponentType, SVGProps } from "react";

function getModelProvider(modelId: string): string {
  const parts = modelId.split("/");
  return parts.length > 1 ? parts[0].toLowerCase() : modelId.toLowerCase();
}

/** Provider slug from an OpenRouter model id (e.g. "anthropic" from "anthropic/claude"). */
export function getModelProviderSlug(modelId: string): string {
  return getModelProvider(modelId);
}

/** Human-readable provider label used for group headers in the model picker. */
const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  "meta-llama": "Meta Llama",
  mistralai: "Mistral",
  mistral: "Mistral",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  cohere: "Cohere",
  "x-ai": "xAI",
  nousresearch: "Nous Research",
  microsoft: "Microsoft",
  perplexity: "Perplexity",
  amazon: "Amazon",
  nvidia: "NVIDIA",
  ai21: "AI21",
  "z-ai": "Z.AI",
  moonshotai: "Moonshot AI",
  inflection: "Inflection",
  liquid: "Liquid",
};

export function getModelProviderLabel(modelId: string): string {
  const slug = getModelProviderSlug(modelId);
  const known = PROVIDER_LABELS[slug];
  if (known) return known;
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}


function OpenAILogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

function AnthropicLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.304 3.541h-3.48l6.157 16.918h3.48zm-10.609 0L.54 20.459H4.1l1.27-3.498h6.47l1.27 3.498h3.56L10.508 3.54zm.68 10.464 2.07-5.7 2.072 5.7z" />
    </svg>
  );
}

function GoogleLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053z" />
    </svg>
  );
}

function MetaLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a4.892 4.892 0 0 0 1.227 2.259c.537.526 1.185.791 1.907.791 1.08 0 2.094-.636 3.12-2.025.559-.76 1.11-1.71 1.646-2.82l.6-1.24c1.266-2.617 2.152-3.953 3.296-3.953.574 0 1.034.37 1.385 1.088.323.66.504 1.548.504 2.696 0 1.548-.397 3.01-1.14 3.907-.348.422-.758.636-1.204.636-.348 0-.65-.132-.906-.376-.258-.244-.47-.604-.645-1.06l-.082-.212c-.138-.384-.256-.607-.398-.706-.142-.1-.346-.143-.624-.143-.496 0-.848.238-1.12.744-.272.506-.392 1.2-.392 1.986 0 .938.184 1.748.564 2.317.548.826 1.406 1.218 2.544 1.218 1.108 0 2.112-.477 3.012-1.381 1.274-1.273 1.986-3.14 1.986-5.448 0-1.88-.435-3.411-1.258-4.445-.844-1.058-2.014-1.594-3.428-1.594-1.604 0-2.964 1.082-4.088 3.266L12 9.95l-.478.973c-.604 1.23-1.146 2.217-1.628 2.924-.736 1.08-1.38 1.55-2.022 1.55-.534 0-.926-.352-1.165-1.018-.18-.503-.27-1.156-.27-1.93 0-2.09.533-4.128 1.442-5.406.515-.724 1.08-1.082 1.69-1.082.44 0 .796.202 1.074.594.255.356.444.847.574 1.462l.068.315c.096.454.178.693.28.844.11.162.35.248.656.248.523 0 .88-.252 1.153-.774.276-.53.392-1.24.392-2.028 0-.912-.182-1.656-.544-2.21-.526-.806-1.356-1.218-2.452-1.218z" />
    </svg>
  );
}

function MistralLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M3.428 0h3.428v3.429H3.428zM17.143 0h3.428v3.429h-3.428zM3.428 3.429h3.428v3.428H3.428zM10.286 3.429h3.428v3.428h-3.428zM17.143 3.429H24v3.428h-6.857zM0 6.857h10.286v3.429H0zM13.714 6.857H24v3.429H13.714zM0 10.286h3.428v3.428H0zM6.857 10.286h10.286v3.428H6.857zM20.571 10.286H24v3.428h-3.429zM0 13.714h10.286v3.429H0zM13.714 13.714H24v3.429H13.714zM3.428 17.143h3.428v3.428H3.428zM10.286 17.143h3.428v3.428h-3.428zM17.143 17.143H24v3.428h-6.857zM3.428 20.571h3.428V24H3.428zM17.143 20.571h3.428V24h-3.428z" />
    </svg>
  );
}

function DeepSeekLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm3.248 6.424c.957.12 1.746.51 2.28 1.165.547.672.764 1.523.764 2.455v.064c-.018 1.88-1.167 3.269-3.093 3.747l-.273.059.21.188c.327.309.62.656.87 1.034.554.84.867 1.845.867 2.845v.268c0 .11-.003.22-.01.328-.11 1.61-1.136 2.867-2.82 3.357a6.26 6.26 0 0 1-1.727.243h-4.81V6.253h4.506c.413 0 .828.024 1.236.07zm-3.775 1.953v3.476h1.906c1.27 0 2.117-.658 2.117-1.755 0-1.11-.834-1.768-2.07-1.768h-.056zm0 5.476v3.874h2.09c.15 0 .301-.01.45-.031 1.086-.152 1.754-.865 1.754-1.895 0-1.11-.784-1.898-1.916-1.948z" />
    </svg>
  );
}

function QwenLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10c1.46 0 2.858-.316 4.114-.882l-1.47-1.47A7.99 7.99 0 0 1 12 20a8 8 0 1 1 8-8 7.99 7.99 0 0 1-.648 3.155l1.47 1.47A9.964 9.964 0 0 0 22 12c0-5.523-4.477-10-10-10zm5.707 14.293a1 1 0 0 1 0 1.414l-2 2a1 1 0 0 1-1.414-1.414l2-2a1 1 0 0 1 1.414 0zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
    </svg>
  );
}

function CohereLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8.553 13.498c1.632 0 3.31-.473 4.773-1.467.736-.5 1.393-1.153 1.86-1.87a4.364 4.364 0 0 0 .742-2.461V7.64c0-1-.325-2.004-.959-2.847A5.433 5.433 0 0 0 12.53 2.67 8.3 8.3 0 0 0 9.5 2.06H3.63v3.438h5.664c.848 0 1.632.217 2.183.62.355.259.719.68.719 1.391 0 .516-.227.924-.664 1.254-.523.394-1.335.604-2.238.604H3.63V13.5zm-.017 4.006h3.94c1.05 0 2.013.093 2.782.448.63.29 1.371.87 1.371 2.048 0 .65-.258 1.154-.686 1.518-.574.49-1.418.746-2.396.768l-.094.002H8.536zM3.63 14.34v8.16h9.565c1.898 0 3.547-.558 4.678-1.569.964-.862 1.557-2.09 1.557-3.503 0-1.227-.44-2.313-1.218-3.132-.943-.99-2.372-1.63-4.07-1.876-.64-.093-1.3-.14-1.984-.14H8.469z" />
    </svg>
  );
}

function XAILogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="m1.002 1.074 8.684 12.678L1 22.926h1.974l7.59-8.003 6.13 8.003H23L14.018 9.882 22.28 1.074h-1.974l-7.166 7.553-5.832-7.553zm2.9 1.5h3.087l13.113 17.852h-3.087z" />
    </svg>
  );
}

function NousResearchLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v6h-2zm0 8h2v2h-2z" />
    </svg>
  );
}

function DefaultModelLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}


const PROVIDER_COLORS: Record<string, string> = {
  openai: "#10A37F",
  anthropic: "#D97757",
  google: "#4285F4",
  "meta-llama": "#0668E1",
  mistralai: "#F7D046",
  mistral: "#F7D046",
  deepseek: "#4D6BFE",
  qwen: "#615EFF",
  cohere: "#39594D",
  "x-ai": "#000000",
  "nousresearch": "#6366F1",
};


const PROVIDER_LOGOS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  openai: OpenAILogo,
  anthropic: AnthropicLogo,
  google: GoogleLogo,
  "meta-llama": MetaLogo,
  mistralai: MistralLogo,
  mistral: MistralLogo,
  deepseek: DeepSeekLogo,
  qwen: QwenLogo,
  cohere: CohereLogo,
  "x-ai": XAILogo,
  nousresearch: NousResearchLogo,
};


interface ModelBrandIconProps {
  modelId: string;
  size?: number;
  className?: string;
}

export function ModelBrandIcon({ modelId, size = 16, className }: ModelBrandIconProps) {
  const provider = getModelProvider(modelId);
  const Logo = PROVIDER_LOGOS[provider] ?? DefaultModelLogo;
  const color = PROVIDER_COLORS[provider];

  return (
    <Logo
      width={size}
      height={size}
      className={className}
      style={color ? { color } : undefined}
      aria-hidden
    />
  );
}

export function getModelBrandIcon(modelId: string, size = 16) {
  return <ModelBrandIcon modelId={modelId} size={size} />;
}
