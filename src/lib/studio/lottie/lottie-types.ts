export interface LottieEase {
  x: number | number[];
  y: number | number[];
}

export interface LottieKey {
  t: number;
  s?: unknown;
  e?: unknown;
  i?: LottieEase;
  o?: LottieEase;
  h?: number;
  to?: number[];
  ti?: number[];
}

export interface LottieProp {
  a?: number;
  k?: unknown;
  x?: unknown;
  y?: unknown;
  s?: unknown;
}

export interface LottieBezier {
  c?: boolean;
  v: number[][];
  i: number[][];
  o: number[][];
}

export interface LottieTransform {
  a?: LottieProp;
  p?: LottieProp;
  s?: LottieProp;
  r?: LottieProp;
  o?: LottieProp;
  sk?: LottieProp;
  sa?: LottieProp;
  rx?: LottieProp;
  ry?: LottieProp;
  rz?: LottieProp;
  or?: LottieProp;
}

export interface LottieShape {
  ty: string;
  nm?: string;
  hd?: boolean;
  [field: string]: unknown;
}

export interface LottieMask {
  mode?: string;
  inv?: boolean;
  nm?: string;
  pt?: LottieProp;
  o?: LottieProp;
  x?: LottieProp;
}

export interface LottieLayer {
  ty: number;
  nm?: string;
  ind?: number;
  parent?: number;
  ip: number;
  op: number;
  st?: number;
  sr?: number;
  ks?: LottieTransform;
  shapes?: LottieShape[];
  masksProperties?: LottieMask[];
  ef?: unknown[];
  tt?: number;
  td?: number;
  ddd?: number;
  ao?: number;
  bm?: number;
  hd?: boolean;
  refId?: string;
  tm?: unknown;
  sc?: string;
  sw?: number;
  sh?: number;
  w?: number;
  h?: number;
}

export interface LottieAsset {
  id: string;
  nm?: string;
  layers?: LottieLayer[];
}

export interface LottieAnimation {
  v?: string;
  nm?: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  ddd?: number;
  layers: LottieLayer[];
  assets?: LottieAsset[];
}
