// Regras sem tela (testadas em tests/regras.test.ts): lista de perguntas, ligação pergunta ↔ áudio, nomes e placar.

export interface AudioInfo { id: string; nome: string; mime: string; tamanho: number; criado: string; alterado: string }
/** Uma pergunta e o(s) áudio(s) do noivo para ela, na ordem (ex.: pergunta-10.ogg e depois pergunta-10-1.ogg). */
export interface Faixa { n: number; pergunta: string; audios: AudioInfo[] }
export type Resultado = 'match' | 'sem_match';

/** Dois dígitos: 4 → "04". */
export const dois = (n: number) => (n < 10 ? '0' : '') + n;

const NUMERACAO = /^\s*(?:pergunta\s*)?(\d{1,3})\s*(?:[.)\-–—:ºª°]+|\s)\s*/i;

/**
 * Lê o texto da lista (Doc, planilha ou .txt): uma pergunta por linha.
 * Se alguma linha vier numerada, só as numeradas contam (as outras são título ou observação) e o número manda.
 */
export function lerPerguntas(texto: string): { n: number; pergunta: string }[] {
  const linhas = texto
    .replace(/^[﻿�]+/, '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/^[\s•*·\-–—]+(?=\S)/, (m) => (/\d/.test(m) ? m : '')).trim())
    .filter((l) => l.length > 0);
  const numeradas = linhas
    .map((l) => {
      const m = l.match(NUMERACAO);
      return m ? { n: Number(m[1]), pergunta: l.slice(m[0].length).trim() } : null;
    })
    .filter((x): x is { n: number; pergunta: string } => !!x && x.pergunta.length > 0 && x.n > 0);
  if (numeradas.length > 0) {
    const vistos = new Set<number>();
    return numeradas.filter((x) => !vistos.has(x.n) && vistos.add(x.n)).sort((a, b) => a.n - b.n);
  }
  return linhas.map((pergunta, i) => ({ n: i + 1, pergunta }));
}

/**
 * Número da pergunta no começo do nome do arquivo, e a parte quando a resposta veio em mais de um áudio:
 * "pergunta-10.ogg" → 10 parte 0 · "pergunta-10-1.ogg" → 10 parte 1 · "03 - viagem.ogg" → 3.
 * Datas como "2026-11-09…" não contam.
 */
export function numeroNoNome(nome: string): { n: number; parte: number } | null {
  const base = nome.replace(/\.[a-z0-9]{2,5}$/i, '');
  const m = base.match(/^\s*(?:faixa|pergunta|resposta|p)?\s*[_\- ]?\s*(\d{1,3})(?!\d)(.*)$/i);
  if (!m) return null;
  const p = m[2].match(/^\s*(?:[-_ ]+\s*(?:parte|pt|p)?\s*(\d{1,2})|\s*\((\d{1,2})\))\s*$/i);
  return { n: Number(m[1]), parte: p ? Number(p[1] ?? p[2]) : 0 };
}

const compararNomes = (a: AudioInfo, b: AudioInfo) =>
  a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true, sensitivity: 'base' }) || a.criado.localeCompare(b.criado);

/**
 * Liga cada pergunta aos seus áudios.
 * - Áudios com número no nome: pelo número (mais de um áudio com o mesmo número tocam em sequência, pela parte).
 *   Os sem número viram faixa bônus.
 * - Nenhum com número: pela ordem dos nomes (nomes do WhatsApp têm data e hora, então a ordem é a da gravação).
 */
export function mapearFaixas(perguntas: { n: number; pergunta: string }[], audios: AudioInfo[]) {
  const avisos: string[] = [];
  const numeros = audios.map((a) => numeroNoNome(a.nome));
  const porNumero = numeros.some((x) => x !== null);
  let faixas: Faixa[];
  let extras: AudioInfo[] = [];
  if (porNumero) {
    const grupos = new Map<number, { a: AudioInfo; parte: number }[]>();
    audios.forEach((a, i) => {
      const x = numeros[i];
      if (!x) return extras.push(a);
      grupos.set(x.n, [...(grupos.get(x.n) ?? []), { a, parte: x.parte }]);
    });
    faixas = perguntas.map((p) => ({
      ...p,
      audios: (grupos.get(p.n) ?? []).sort((x, y) => x.parte - y.parte || compararNomes(x.a, y.a)).map((x) => x.a),
    }));
    const sobrando = [...grupos.keys()].filter((k) => !perguntas.some((p) => p.n === k)).sort((a, b) => a - b);
    if (sobrando.length) avisos.push(`Áudio sem pergunta: ${sobrando.map((k) => grupos.get(k)!.map((x) => x.a.nome).join(', ')).join(', ')}`);
    const varios = faixas.filter((f) => f.audios.length > 1);
    if (varios.length) avisos.push(`Tocam em sequência: ${varios.map((f) => f.audios.map((a) => a.nome).join(' + ')).join(' · ')}`);
    extras = extras.sort(compararNomes);
    if (extras.length) avisos.push(`Faixa bônus (no fim): ${extras.map((a) => a.nome).join(', ')}`);
  } else {
    const ordenados = [...audios].sort(compararNomes);
    faixas = perguntas.map((p, i) => ({ ...p, audios: ordenados[i] ? [ordenados[i]] : [] }));
    if (audios.length) avisos.push('Áudios ligados às perguntas pela ordem dos nomes dos arquivos');
    if (ordenados.length > perguntas.length) avisos.push(`${ordenados.length - perguntas.length} áudio(s) sobrando no fim da lista`);
  }
  const sem = faixas.filter((f) => !f.audios.length).map((f) => dois(f.n));
  if (sem.length) avisos.push(`Sem áudio do noivo: faixa ${sem.join(', ')}`);
  return { faixas, extras, porNumero, avisos };
}

/** Tipo de áudio sem os parâmetros, com os .ogg do WhatsApp reconhecidos pelo nome. */
export function tipoDoAudio(mime: string, nome = ''): string {
  const base = (mime || '').split(';')[0].trim().toLowerCase();
  if (/ogg|opus/.test(base) || /\.(ogg|opus|oga)$/i.test(nome)) return 'audio/ogg';
  if (base === 'audio/x-m4a' || /\.m4a$/i.test(nome)) return 'audio/mp4';
  return base || 'application/octet-stream';
}

export function extensao(mime: string): string {
  const t = tipoDoAudio(mime);
  return ({ 'audio/mp4': 'm4a', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/aac': 'aac' } as Record<string, string>)[t] ?? 'audio';
}

/** Nome do arquivo da resposta da noiva no Drive: "04 - O que ele mais admira na Fernanda.m4a". */
export function nomeDaResposta(n: number, pergunta: string, mime: string, versao = 1): string {
  const limpa = pergunta.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80).replace(/[\s.]+$/, '');
  return `${dois(n)} - ${limpa}${versao > 1 ? ` (${versao})` : ''}.${extensao(mime)}`;
}

export function placar(faixas: { n: number }[], resultados: Map<number, Resultado>) {
  let match = 0;
  let semMatch = 0;
  for (const f of faixas) {
    const r = resultados.get(f.n);
    if (r === 'match') match++;
    else if (r === 'sem_match') semMatch++;
  }
  const proxima = faixas.find((f) => !resultados.has(f.n))?.n ?? null;
  return { match, semMatch, tocadas: match + semMatch, total: faixas.length, proxima };
}

export function fraseDoFim(match: number, total: number): string {
  if (total === 0) return '';
  const p = match / total;
  if (p === 1) return 'Conhece o noivo de olhos fechados.';
  if (p >= 0.7) return 'Sintonia de casal pronto pro altar.';
  if (p >= 0.4) return 'Tem match, mas ainda dá pra estudar o noivo.';
  return 'Ainda bem que vocês têm a vida inteira pra se conhecer.';
}

/** Tempo de fita: 75 → "1:15". */
export function tempo(seg: number): string {
  if (!isFinite(seg) || seg < 0) seg = 0;
  const s = Math.floor(seg);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Chave do link das madrinhas (#k=…). */
export function chaveDoEndereco(hash: string): string | null {
  const m = hash.match(/[#&]k=([a-f0-9]{32,128})/i);
  return m ? m[1] : null;
}
