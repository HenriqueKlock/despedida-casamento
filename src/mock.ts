import { OGG_TESTE } from './mock-audio';
import type { Ponte } from './ponte';

// Ponte de teste (npm run dev:mock): perguntas de exemplo e um tom em .ogg no lugar dos áudios.
// Só entra no build quando VITE_MOCK=1; o app publicado fala com o Apps Script de verdade.

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const recebidas: { tipo: string; dados: unknown }[] = [];
const arquivos: { nome: string; mime: string; base64: string }[] = [];
// a subpasta "Respostas da Fernanda" de mentira: dá pra apagar pelo console com __apagarNoDrive('01 -')
const drive: { id: string; nome: string; mime: string; base64: string; alterado: string }[] = [];
(window as unknown as { __apagarNoDrive: (trecho: string) => number }).__apagarNoDrive = (trecho) => {
  const antes = drive.length;
  for (let i = drive.length - 1; i >= 0; i--) if (drive[i].nome.includes(trecho)) drive.splice(i, 1);
  return antes - drive.length;
};
(window as unknown as { __ponte: typeof recebidas; __arquivos: typeof arquivos }).__ponte = recebidas;
(window as unknown as { __arquivos: typeof arquivos }).__arquivos = arquivos;

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

export const ponteDeTeste: Ponte = {
  async lista() {
    await espera(400);
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
      respostas: drive.map((r) => ({ id: r.id, nome: r.nome, mime: r.mime, tamanho: r.base64.length, criado: r.alterado, alterado: r.alterado })),
    };
  },
  async audio(id) {
    await espera(250);
    const r = drive.find((x) => x.id === id);
    if (r) return { id, nome: r.nome, mime: r.mime, base64: r.base64 };
    return { id, nome: id + '.ogg', mime: 'audio/ogg', base64: OGG_TESTE };
  },
  async resposta(p) {
    await espera(300);
    recebidas.push({ tipo: 'resposta', dados: { ...p, base64: p.base64.length + ' caracteres' } });
    arquivos.push({ nome: p.nome, mime: p.mime, base64: p.base64 });
    drive.push({ id: 'arq-' + p.id, nome: p.nome, mime: p.mime, base64: p.base64, alterado: new Date().toISOString() });
    return { arquivo: 'arq-' + p.id, repetido: false };
  },
  async placar(p) {
    await espera(150);
    recebidas.push({ tipo: 'placar', dados: p });
    return { repetido: false };
  },
};
