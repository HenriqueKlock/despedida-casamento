import { esc } from './ui';

// A fita cassete do mockup, desenhada em SVG. Os carretéis giram com a classe .gira no <svg> (CSS),
// e a quantidade de fita em cada lado acompanha o progresso do áudio (raios r-esq e r-dir).

export interface OpcoesFita {
  titulo: string;
  lado?: 'A' | 'B';
  corpo?: 'escuro' | 'claro';
  faixas?: [string, string];
  /** 0 = toda a fita no carretel da esquerda, 1 = toda na direita */
  progresso?: number;
  lacre?: string | null;
  gira?: boolean;
  classe?: string;
}

const RAIO_MIN = 13;
const RAIO_MAX = 24;
export function raios(progresso: number) {
  const p = Math.max(0, Math.min(1, progresso));
  return { esq: RAIO_MAX - (RAIO_MAX - RAIO_MIN) * p, dir: RAIO_MIN + (RAIO_MAX - RAIO_MIN) * p };
}

const raiosDoCubo = (cx: number) =>
  `M${cx} 93 V96 M${cx} 108 V111 M${cx - 7.8} 97.5 L${cx - 5.2} 99 M${cx + 5.2} 105 L${cx + 7.8} 106.5 M${cx - 7.8} 106.5 L${cx - 5.2} 105 M${cx + 5.2} 99 L${cx + 7.8} 97.5`;

const carretel = (cx: number) =>
  `<g class="carretel" style="transform-origin:${cx}px 102px"><circle cx="${cx}" cy="102" r="11" fill="#F6EFDF"/><circle cx="${cx}" cy="102" r="4" fill="#1B1714"/><path d="${raiosDoCubo(cx)}" stroke="#1B1714" stroke-width="2.5" stroke-linecap="round"/></g>`;

export function fitaSvg(o: OpcoesFita): string {
  const corpo = o.corpo === 'claro' ? '#4A4038' : '#2A241F';
  const furos = o.corpo === 'claro' ? '#2A241F' : '#4A4038';
  const [f1, f2] = o.faixas ?? ['#B5542A', '#D9A441'];
  const r = raios(o.progresso ?? 0.15);
  const lacre = o.lacre
    ? `<g transform="rotate(-9 160 104)"><rect x="-14" y="88" width="348" height="34" fill="#B5542A"/><rect x="-14" y="88" width="348" height="34" fill="none" stroke="#7A3519" stroke-width="1" stroke-dasharray="4 3"/><text x="160" y="110" text-anchor="middle" font-family="'Special Elite', monospace" font-size="14" letter-spacing="2" fill="#FFFFFF">${esc(o.lacre)}</text></g>`
    : '';
  return `<svg class="fita ${o.gira ? 'gira' : ''} ${o.classe ?? ''}" viewBox="0 0 320 204" aria-hidden="true">
<rect x="2" y="2" width="316" height="200" rx="14" fill="${corpo}"/>
<circle cx="14" cy="14" r="4" fill="${furos}"/><circle cx="306" cy="14" r="4" fill="${furos}"/><circle cx="14" cy="190" r="4" fill="${furos}"/><circle cx="306" cy="190" r="4" fill="${furos}"/>
<rect x="20" y="16" width="280" height="124" rx="6" fill="#F6EFDF"/>
<rect x="20" y="22" width="280" height="9" fill="${f1}"/>
<rect x="20" y="31" width="280" height="6" fill="${f2}"/>
<text x="32" y="62" font-family="Caveat, cursive" font-size="25" font-weight="700" fill="#2A241F">${esc(o.titulo)}</text>
<text x="288" y="62" text-anchor="end" font-family="'Special Elite', monospace" font-size="18" fill="#B5542A">${o.lado ?? 'A'}</text>
<line x1="32" y1="68" x2="288" y2="68" stroke="#C9BBA0" stroke-width="1"/>
<rect x="72" y="76" width="176" height="52" rx="26" fill="#1B1714"/>
<circle class="r-esq" cx="114" cy="102" r="${r.esq.toFixed(1)}" fill="#5A3B25"/>
<circle class="r-dir" cx="206" cy="102" r="${r.dir.toFixed(1)}" fill="#5A3B25"/>
<rect x="146" y="92" width="28" height="20" fill="#1B1714" stroke="#3A322B"/>
${carretel(114)}${carretel(206)}
<path d="M70 202 L84 158 L236 158 L250 202 Z" fill="#3A322B"/>
<circle cx="110" cy="182" r="5" fill="#1B1714"/><circle cx="210" cy="182" r="5" fill="#1B1714"/>
<rect x="148" y="176" width="8" height="8" fill="#1B1714"/><rect x="164" y="176" width="8" height="8" fill="#1B1714"/>
${lacre}
</svg>`;
}

/** Atualiza a quantidade de fita em cada carretel sem redesenhar. */
export function moverFita(svg: SVGSVGElement | null, progresso: number) {
  if (!svg) return;
  const r = raios(progresso);
  svg.querySelector('.r-esq')?.setAttribute('r', r.esq.toFixed(1));
  svg.querySelector('.r-dir')?.setAttribute('r', r.dir.toFixed(1));
}

export const icone = {
  play: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4 L20 12 L7 20 Z" fill="currentColor"/></svg>',
  pausa: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="5" height="16" fill="currentColor"/><rect x="14" y="4" width="5" height="16" fill="currentColor"/></svg>',
  rebobinar: '<svg class="ic ic-largo" viewBox="0 0 28 20" aria-hidden="true"><path d="M13 3 L3 10 L13 17 Z M25 3 L15 10 L25 17 Z" fill="currentColor"/></svg>',
  denovo: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 a8 8 0 1 0 2.5 -5.8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M3 3 V8 H8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  voltar: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cadeado: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11 V8 a4 4 0 0 1 8 0 V11" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  aberto: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11 V8 a4 4 0 0 1 7.5 -2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 L10 17 L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  rec: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="currentColor"/></svg>',
  parar: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/></svg>',
};
