# Ícones — arquivos-fonte

Os 208 desenhos do sistema próprio, em grade 24x24, traço 1.5.

Duas camadas de cor: o traço base usa `currentColor` (segue a
propriedade `color`), e as partes de destaque usam
`var(--icon-accent, currentColor)`. O `--icon-accent` é definido em
`globals.css` como `hsl(var(--primary-ink))`, que já vira sozinho
entre tema claro e escuro.

`../glyphs.tsx` é **gerado** a partir desta pasta — não edite lá.
O gerador e a geometria vivem em `~/icon-system` (`build.py` +
`defs/`); rode `python3 emit_vozko.py` de lá para regerar.

Perfil `sharp` (terminais retos, cantos em ponta) é uma classe CSS,
`.vz-icon--sharp` — a geometria é a mesma.
