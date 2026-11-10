import { OGG_TESTE } from './mock-audio';
import type { Ponte } from './ponte';

// Ponte de teste (npm run dev:mock): perguntas de exemplo e um tom em .ogg no lugar dos áudios.
// Só entra no build quando VITE_MOCK=1; o app publicado fala com o Apps Script de verdade.

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const recebidas: { tipo: string; dados: unknown }[] = [];
(window as unknown as { __ponte: typeof recebidas }).__ponte = recebidas;

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
      audios: perguntas.map((_, i) => ({
        id: 'audio-' + (i + 1),
        nome: `WhatsApp Ptt 2026-11-09 at 21.${String(10 + i).padStart(2, '0')}.00.ogg`,
        mime: 'audio/ogg',
        tamanho: 10089,
        criado: '2026-11-09T21:00:00Z',
        alterado: '2026-11-09T21:00:00Z',
      })),
    };
  },
  async audio(id) {
    await espera(250);
    return { id, nome: id + '.ogg', mime: 'audio/ogg', base64: OGG_TESTE };
  },
  async resposta(p) {
    await espera(300);
    recebidas.push({ tipo: 'resposta', dados: { ...p, base64: p.base64.length + ' caracteres' } });
    return { arquivo: 'arq-' + p.id, repetido: false };
  },
  async placar(p) {
    await espera(150);
    recebidas.push({ tipo: 'placar', dados: p });
    return { repetido: false };
  },
};
