import { PONTE_URL } from './config';
import type { AudioInfo } from './regras';

// Conversa com a ponte do Drive (Apps Script). Tudo por POST em text/plain: sem pré-voo de CORS e a chave fica fora do endereço.

export interface ListaBruta {
  pasta: string;
  lista: { id: string; nome: string; alterado: string; texto: string } | null;
  audios: AudioInfo[];
}
export interface AudioBruto { id: string; nome: string; mime: string; base64: string }
export interface Ponte {
  lista(): Promise<ListaBruta>;
  audio(id: string): Promise<AudioBruto>;
  resposta(p: { id: string; faixa: number; nome: string; mime: string; base64: string }): Promise<{ arquivo: string; repetido: boolean }>;
  placar(p: { id: string; faixa: number; pergunta: string; resultado: string; resposta: string | null }): Promise<{ repetido: boolean }>;
}

const CHAVE = 'despedida.chave';
export function lerChave(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}
export function guardarChave(k: string) {
  try {
    localStorage.setItem(CHAVE, k);
  } catch {
    /* navegação privada: a chave vale só nesta aba */
  }
  chaveNaMemoria = k;
}
let chaveNaMemoria: string | null = null;
const chave = () => chaveNaMemoria ?? lerChave();

/** Erro que vale tentar de novo (sem internet, ponte fora do ar). Os outros são recusas da ponte. */
export class ErroDeRede extends Error {}

const MENSAGENS: Record<string, string> = {
  chave: 'Link sem a chave certa. Abra pelo link das madrinhas.',
  ponte_sem_chave: 'A ponte do Drive ainda não tem chave (rodar gerarChave no Apps Script).',
  fora_da_pasta: 'Esse áudio não está na pasta da despedida.',
};

async function chamar<T>(corpo: Record<string, unknown>, ms: number): Promise<T> {
  if (!PONTE_URL) throw new Error('A ponte do Drive ainda não foi configurada.');
  const k = chave();
  if (!k) throw new Error(MENSAGENS.chave);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  let r: Response;
  try {
    r = await fetch(PONTE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...corpo, chave: k }),
      signal: ctrl.signal,
      redirect: 'follow',
    });
  } catch (e) {
    throw new ErroDeRede(e instanceof Error && e.name === 'AbortError' ? 'A ponte demorou demais' : 'Sem conexão com o Drive');
  } finally {
    clearTimeout(t);
  }
  if (!r.ok) throw new ErroDeRede('Drive respondeu ' + r.status);
  let j: { ok: boolean; dados?: T; erro?: string };
  try {
    j = await r.json();
  } catch {
    throw new ErroDeRede('Resposta estranha da ponte');
  }
  if (!j.ok) {
    const cod = String(j.erro ?? '');
    if (cod.startsWith('lista_formato:')) throw new Error(`A lista "${cod.slice(14)}" precisa ser Google Docs, planilha ou .txt.`);
    throw new Error(MENSAGENS[cod] ?? cod);
  }
  return j.dados as T;
}

const real: Ponte = {
  lista: () => chamar({ acao: 'lista' }, 30_000),
  audio: (id) => chamar({ acao: 'audio', id }, 90_000),
  resposta: (p) => chamar({ acao: 'resposta', ...p }, 90_000),
  placar: (p) => chamar({ acao: 'placar', ...p }, 30_000),
};

let ponteAtual: Ponte = real;
export const ponte = () => ponteAtual;
export const usarPonte = (p: Ponte) => (ponteAtual = p);
