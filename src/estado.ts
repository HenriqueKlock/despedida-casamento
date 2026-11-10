import { ErroDeRede, lerChave, ponte, type ListaBruta } from './ponte';
import { lerPerguntas, mapearFaixas, nomeDaResposta, type AudioInfo, type Faixa, type Resultado } from './regras';
import { db, gravacoesPorFaixa, type AudioGuardado, type Gravacao, type Marcacao } from './store';

// Estado do app na festa. As telas leem daqui e se redesenham quando algo muda.

export type Carga = 'sem_chave' | 'carregando' | 'pronta' | 'erro';
export interface Estado {
  carga: Carga;
  erro: string | null;
  /** usando o que já estava no aparelho porque o Drive não respondeu */
  semDrive: boolean;
  baixados: number;
  totalAudios: number;
  faixas: Faixa[];
  /** áudios sem número no nome: faixa bônus, no fim */
  extras: AudioInfo[];
  avisos: string[];
  resultados: Map<number, Resultado>;
  marcacoes: Map<number, Marcacao>;
  gravacoes: Map<number, Gravacao>;
  /** respostas e marcações que ainda não chegaram ao Drive */
  naFila: number;
  respostasNoDrive: number;
  recusadas: number;
}

export const estado: Estado = {
  carga: 'carregando', erro: null, semDrive: false, baixados: 0, totalAudios: 0, faixas: [], extras: [], avisos: [],
  resultados: new Map(), marcacoes: new Map(), gravacoes: new Map(), naFila: 0, respostasNoDrive: 0, recusadas: 0,
};

const ouvintes = new Set<() => void>();
export function aoMudar(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}
function mudou() {
  ouvintes.forEach((fn) => fn());
}

export const faixa = (n: number) => estado.faixas.find((f) => f.n === n) ?? null;

/* ---------- carga: lista e áudios do noivo ---------- */

function aplicarLista(l: ListaBruta) {
  const perguntas = l.lista ? lerPerguntas(l.lista.texto) : [];
  const m = mapearFaixas(perguntas, l.audios);
  estado.faixas = m.faixas;
  estado.extras = m.extras;
  estado.avisos = l.lista ? m.avisos : ['Não achei a lista de perguntas na pasta do Drive'];
}

const base64ParaBlob = (b64: string, mime: string) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

const todosOsAudios = () => [...estado.faixas.flatMap((f) => f.audios), ...estado.extras];

async function audiosFaltando() {
  const faltam: AudioInfo[] = [];
  for (const a of todosOsAudios()) {
    const g = await db.audios.get(a.id);
    if (!g || g.alterado !== a.alterado) faltam.push(a);
  }
  return faltam;
}

async function contarBaixados() {
  estado.totalAudios = todosOsAudios().length;
  estado.baixados = estado.totalAudios - (await audiosFaltando()).length;
}

let carregando: Promise<void> | null = null;
export function carregar(): Promise<void> {
  if (!carregando) carregando = rodarCarga().finally(() => (carregando = null));
  return carregando;
}

/** O que já está no aparelho, antes de abrir a primeira tela (recarregar a página no meio da brincadeira não volta para a capa). */
export async function carregarDoAparelho() {
  if (!lerChave()) {
    estado.carga = 'sem_chave';
    return;
  }
  const guardada = await db.lista.get('atual');
  if (guardada) {
    aplicarLista(guardada);
    await contarBaixados();
  }
  estado.carga = guardada && estado.baixados === estado.totalAudios ? 'pronta' : 'carregando';
  await reler();
}

async function rodarCarga() {
  await carregarDoAparelho();
  if (estado.carga === 'sem_chave') return mudou();
  estado.erro = null;
  mudou();
  try {
    const l = await ponte().lista();
    await db.lista.put({ ...l, chave: 'atual', carregada: Date.now() });
    aplicarLista(l);
    await contarBaixados();
    mudou();
    const faltam = await audiosFaltando();
    // dois de cada vez: rápido sem estourar o Apps Script
    let i = 0;
    const trabalhador = async () => {
      while (i < faltam.length) {
        const a = faltam[i++];
        const r = await ponte().audio(a.id);
        await db.audios.put({ id: a.id, alterado: a.alterado, nome: a.nome, mime: r.mime || a.mime, blob: base64ParaBlob(r.base64, r.mime || a.mime) });
        estado.baixados++;
        mudou();
      }
    };
    await Promise.all([trabalhador(), trabalhador()]);
    estado.semDrive = false;
    estado.carga = 'pronta';
  } catch (e) {
    const completa = estado.faixas.length > 0 && estado.baixados === estado.totalAudios;
    estado.semDrive = completa;
    estado.carga = completa ? 'pronta' : 'erro';
    estado.erro = e instanceof ErroDeRede ? 'Não consegui falar com o Drive. Confira a internet.' : e instanceof Error ? e.message : String(e);
  }
  mudou();
}

/** Chave da fita de uma faixa (muda se algum áudio dela mudar). */
export const chaveDaFita = (audios: AudioInfo[]) => audios.map((a) => a.id + '@' + a.alterado).join('+');

async function guardados(audios: AudioInfo[]): Promise<AudioGuardado[]> {
  const gs = await Promise.all(audios.map((a) => db.audios.get(a.id)));
  return gs.filter((g): g is AudioGuardado => !!g);
}
/** As partes da resposta do noivo para a faixa, na ordem. */
export const audiosDoNoivo = (n: number) => guardados(faixa(n)?.audios ?? []);
export const audiosBonus = () => guardados(estado.extras);

/* ---------- respostas da noiva e placar ---------- */

async function reler() {
  estado.gravacoes = await gravacoesPorFaixa();
  const ms = await db.marcacoes.toArray();
  estado.marcacoes = new Map(ms.map((m) => [m.faixa, m]));
  estado.resultados = new Map(ms.map((m) => [m.faixa, m.resultado]));
  const gs = await db.gravacoes.toArray();
  estado.respostasNoDrive = new Set(gs.filter((g) => g.enviada).map((g) => g.faixa)).size;
  estado.naFila = gs.filter((g) => !g.enviada && !g.erro).length + ms.filter((m) => !m.enviada && !m.erro).length;
  estado.recusadas = gs.filter((g) => g.erro).length + ms.filter((m) => m.erro).length;
  mudou();
}

const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));

export async function guardarResposta(n: number, blob: Blob, mime: string) {
  const f = faixa(n);
  const versao = (await db.gravacoes.where('faixa').equals(n).count()) + 1;
  await db.gravacoes.put({
    id: novoId(), faixa: n, nome: nomeDaResposta(n, f?.pergunta ?? '', mime, versao), mime, blob, criado: Date.now(), enviada: 0,
  });
  await reler();
  descarregar();
}

export async function marcar(n: number, resultado: Resultado) {
  const f = faixa(n);
  await db.marcacoes.put({
    faixa: n, id: novoId(), resultado, pergunta: f?.pergunta ?? '', resposta: estado.gravacoes.get(n)?.nome ?? null, quando: Date.now(), enviada: 0,
  });
  await reler();
  descarregar();
}

export async function zerarPlacar() {
  await db.marcacoes.clear();
  await reler();
}

/* ---------- fila para o Drive ---------- */

const blobParaBase64 = (b: Blob) =>
  new Promise<string>((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => falha(r.error);
    r.readAsDataURL(b);
  });

let enviando: Promise<void> | null = null;
export function descarregar(): Promise<void> {
  if (!enviando) enviando = rodarFila().finally(() => (enviando = null));
  return enviando;
}

async function rodarFila() {
  if (!lerChave()) return;
  try {
    for (const g of await db.gravacoes.where('enviada').equals(0).sortBy('criado')) {
      if (g.erro) continue;
      try {
        await ponte().resposta({ id: g.id, faixa: g.faixa, nome: g.nome, mime: g.mime, base64: await blobParaBase64(g.blob) });
        await db.gravacoes.update(g.id, { enviada: 1 });
      } catch (e) {
        if (e instanceof ErroDeRede) throw e;
        await db.gravacoes.update(g.id, { erro: e instanceof Error ? e.message : String(e) });
      }
      await reler();
    }
    for (const m of await db.marcacoes.where('enviada').equals(0).toArray()) {
      if (m.erro) continue;
      try {
        await ponte().placar({ id: m.id, faixa: m.faixa, pergunta: m.pergunta, resultado: m.resultado, resposta: m.resposta });
        // só marca como enviada se ninguém trocou o resultado enquanto isso
        await db.marcacoes.where('faixa').equals(m.faixa).filter((x) => x.id === m.id).modify({ enviada: 1 });
      } catch (e) {
        if (e instanceof ErroDeRede) throw e;
        await db.marcacoes.where('faixa').equals(m.faixa).filter((x) => x.id === m.id).modify({ erro: e instanceof Error ? e.message : String(e) });
      }
      await reler();
    }
  } catch {
    /* sem internet: tenta de novo depois */
  }
  await reler();
}

/** Tenta de novo ao voltar a internet, ao reabrir o app e a cada 20 s. */
export function iniciarFila() {
  const tentar = () => navigator.onLine && estado.naFila > 0 && descarregar();
  window.addEventListener('online', () => {
    tentar();
    if (estado.carga !== 'pronta' || estado.semDrive) carregar();
  });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && tentar());
  setInterval(tentar, 20_000);
  reler().then(() => descarregar());
}
