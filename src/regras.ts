// Regras sem tela (testadas em tests/regras.test.ts): lista de perguntas, ligação pergunta ↔ áudio, nomes e placar.

export interface AudioInfo { id: string; nome: string; mime: string; tamanho: number; criado: string; alterado: string }
export interface Faixa { n: number; pergunta: string; audio: AudioInfo | null }
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
    .replace(/\r/g, '')
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

/** Número no começo do nome do arquivo ("03 - viagem.ogg" → 3). Datas como "2026-11-09…" não contam. */
export function numeroNoNome(nome: string): number | null {
  const m = nome.match(/^\s*(?:faixa|pergunta|p)?\s*[_\- ]?\s*(\d{1,3})(?!\d)/i);
  return m ? Number(m[1]) : null;
}

const compararNomes = (a: AudioInfo, b: AudioInfo) =>
  a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true, sensitivity: 'base' }) || a.criado.localeCompare(b.criado);

/**
 * Liga cada pergunta ao seu áudio.
 * - Todos os áudios com número no nome (sem repetir): pelo número.
 * - Senão: pela ordem dos nomes (nomes do WhatsApp têm data e hora, então a ordem é a da gravação).
 */
export function mapearFaixas(perguntas: { n: number; pergunta: string }[], audios: AudioInfo[]) {
  const avisos: string[] = [];
  const numeros = audios.map((a) => numeroNoNome(a.nome));
  const porNumero = audios.length > 0 && numeros.every((x) => x !== null) && new Set(numeros).size === audios.length;
  let faixas: Faixa[];
  if (porNumero) {
    const mapa = new Map(audios.map((a, i) => [numeros[i]!, a]));
    faixas = perguntas.map((p) => ({ ...p, audio: mapa.get(p.n) ?? null }));
    const sobrando = audios.filter((_, i) => !perguntas.some((p) => p.n === numeros[i]));
    if (sobrando.length) avisos.push(`${sobrando.length} áudio(s) com número sem pergunta: ${sobrando.map((a) => a.nome).join(', ')}`);
  } else {
    const ordenados = [...audios].sort(compararNomes);
    faixas = perguntas.map((p, i) => ({ ...p, audio: ordenados[i] ?? null }));
    if (audios.length) avisos.push('Áudios ligados às perguntas pela ordem dos nomes dos arquivos');
    if (ordenados.length > perguntas.length) avisos.push(`${ordenados.length - perguntas.length} áudio(s) sobrando no fim da lista`);
  }
  const sem = faixas.filter((f) => !f.audio).map((f) => dois(f.n));
  if (sem.length) avisos.push(`Sem áudio do noivo: faixa ${sem.join(', ')}`);
  return { faixas, porNumero, avisos };
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
