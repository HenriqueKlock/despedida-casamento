import { OGG_TESTE } from './mock-audio';
import type { ListaBruta, Ponte } from './ponte';

// Ponte de teste (npm run dev:mock): perguntas de exemplo e um tom em .ogg no lugar dos áudios.
// Só entra no build quando VITE_MOCK=1; o app publicado fala com o Apps Script de verdade.
// O "Drive" de mentira (respostas dela, placar e senha) fica no localStorage, para a página do noivo enxergar.

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const recebidas: { tipo: string; dados: unknown }[] = [];
const arquivos: { nome: string; mime: string; base64: string }[] = [];

interface RespostaMock { id: string; nome: string; mime: string; base64: string; alterado: string }
interface DriveMock { respostas: RespostaMock[]; placar: Record<string, 'match' | 'sem_match'>; senha: string | null }
const ler = (): DriveMock => {
  try {
    return JSON.parse(localStorage.getItem('mock.drive') ?? '') as DriveMock;
  } catch {
    return { respostas: [], placar: {}, senha: null };
  }
};
const gravar = (d: DriveMock) => localStorage.setItem('mock.drive', JSON.stringify(d));

const w = window as unknown as Record<string, unknown>;
w.__ponte = recebidas;
w.__arquivos = arquivos;
// apaga respostas do "Drive" pelo console: __apagarNoDrive('01 -')
w.__apagarNoDrive = (trecho: string) => {
  const d = ler();
  const antes = d.respostas.length;
  d.respostas = d.respostas.filter((r) => !r.nome.includes(trecho));
  gravar(d);
  return antes - d.respostas.length;
};

const perguntas = [
  'Onde foi o primeiro encontro de vocês?',
  'Qual comida ele nunca comeria?',
  'Quem disse "eu te amo" primeiro?',
  'O que ele mais admira na Fernanda?',
  'Qual a mania dela que ele mais implica?',
  'Qual bicho da casa é o preferido dele?',
  'Onde ele imagina vocês daqui a 10 anos?',
  'Qual música lembra ela?',
];

function lista(): ListaBruta {
  const d = ler();
  return {
    pasta: 'Despedida (teste)',
    lista: { id: 'lista', nome: 'Perguntas', alterado: '2026-11-09T21:00:00Z', texto: 'Perguntas pro noivo\n' + perguntas.map((p, i) => `${i + 1}. ${p}`).join('\n') },
    // como na pasta do Henrique: pergunta-N.ogg, uma resposta em duas partes e um extra sem número
    audios: [...perguntas.map((_, i) => `pergunta-${i + 1}.ogg`), 'pergunta-3-1.ogg', 'extra.ogg'].map((nome) => ({
      id: 'audio-' + nome.replace('.ogg', ''),
      nome,
      mime: 'audio/ogg',
      tamanho: 10089,
      criado: '2026-11-09T21:00:00Z',
      alterado: '2026-11-09T21:00:00Z',
    })),
    respostas: d.respostas.map((r) => ({ id: r.id, nome: r.nome, mime: r.mime, tamanho: r.base64.length, criado: r.alterado, alterado: r.alterado })),
    senhaCriada: !!d.senha,
  };
}

function audio(id: string) {
  const r = ler().respostas.find((x) => x.id === id);
  if (r) return { id, nome: r.nome, mime: r.mime, base64: r.base64 };
  return { id, nome: id + '.ogg', mime: 'audio/ogg', base64: OGG_TESTE };
}

function conferirSenha(senha: string) {
  const d = ler();
  if (!d.senha) throw new Error('A Fernanda ainda não liberou a fita. A senha aparece pra ela no fim da brincadeira.');
  if (senha.trim().toLowerCase() !== d.senha) throw new Error('Senha errada. Confira com a Fernanda.');
}

export const ponteDeTeste: Ponte = {
  async lista() {
    await espera(400);
    return lista();
  },
  async audio(id) {
    await espera(250);
    return audio(id);
  },
  async resposta(p) {
    await espera(300);
    recebidas.push({ tipo: 'resposta', dados: { ...p, base64: p.base64.length + ' caracteres' } });
    arquivos.push({ nome: p.nome, mime: p.mime, base64: p.base64 });
    const d = ler();
    d.respostas.push({ id: 'arq-' + p.id, nome: p.nome, mime: p.mime, base64: p.base64, alterado: new Date().toISOString() });
    gravar(d);
    return { arquivo: 'arq-' + p.id, repetido: false };
  },
  async placar(p) {
    await espera(150);
    recebidas.push({ tipo: 'placar', dados: p });
    const d = ler();
    d.placar[String(p.faixa)] = p.resultado as 'match' | 'sem_match';
    gravar(d);
    return { repetido: false };
  },
  async senha(senha) {
    await espera(300);
    const s = senha.trim().toLowerCase();
    if (s.length < 4) throw new Error('A senha precisa ter pelo menos 4 letras ou números.');
    recebidas.push({ tipo: 'senha', dados: s });
    const d = ler();
    d.senha = s;
    gravar(d);
    return { criada: true };
  },
  async noivoLista(senha) {
    await espera(400);
    conferirSenha(senha);
    return { ...lista(), resultados: ler().placar };
  },
  async noivoAudio(senha, id) {
    await espera(250);
    conferirSenha(senha);
    return audio(id);
  },
};
