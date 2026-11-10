import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chaveDoEndereco, extensao, fraseDoFim, lerPerguntas, mapearFaixas, nomeDaResposta, numeroNoNome, placar, tempo, tipoDoAudio,
  type AudioInfo, type Resultado,
} from '../src/regras.ts';

const audio = (nome: string, criado = '2026-11-09T20:00:00Z'): AudioInfo => ({ id: nome, nome, mime: 'audio/ogg', tamanho: 1, criado, alterado: criado });

test('lista numerada: ignora título e observações, usa o número', () => {
  const r = lerPerguntas('Perguntas pro Henrique\n\n1. Onde foi o primeiro encontro?\n2) Qual comida ele nunca comeria?\n03 - Quem disse eu te amo primeiro?\nobs: pode rir\n');
  assert.deepEqual(r, [
    { n: 1, pergunta: 'Onde foi o primeiro encontro?' },
    { n: 2, pergunta: 'Qual comida ele nunca comeria?' },
    { n: 3, pergunta: 'Quem disse eu te amo primeiro?' },
  ]);
});

test('lista sem número: uma pergunta por linha, na ordem', () => {
  const r = lerPerguntas('• Onde foi o primeiro encontro?\r\n- Qual a música dela?\n\n');
  assert.deepEqual(r, [
    { n: 1, pergunta: 'Onde foi o primeiro encontro?' },
    { n: 2, pergunta: 'Qual a música dela?' },
  ]);
});

test('lista: "Pergunta 2:" e números fora de ordem', () => {
  const r = lerPerguntas('Pergunta 2: B?\nPergunta 1: A?');
  assert.deepEqual(r.map((x) => [x.n, x.pergunta]), [[1, 'A?'], [2, 'B?']]);
});

test('número no nome do arquivo', () => {
  assert.equal(numeroNoNome('03 - viagem.ogg'), 3);
  assert.equal(numeroNoNome('12.ogg'), 12);
  assert.equal(numeroNoNome('faixa_7.ogg'), 7);
  assert.equal(numeroNoNome('P4.opus'), 4);
  assert.equal(numeroNoNome('WhatsApp Ptt 2026-11-09 at 21.15.03.ogg'), null);
  assert.equal(numeroNoNome('2026-11-09 audio.ogg'), null);
  assert.equal(numeroNoNome('PTT-20261109-WA0012.opus'), null);
});

test('ligação pelo número', () => {
  const r = mapearFaixas(lerPerguntas('1. A\n2. B\n3. C'), [audio('2.ogg'), audio('1.ogg'), audio('3 - c.ogg')]);
  assert.equal(r.porNumero, true);
  assert.deepEqual(r.faixas.map((f) => f.audio?.nome), ['1.ogg', '2.ogg', '3 - c.ogg']);
  assert.deepEqual(r.avisos, []);
});

test('ligação pela ordem dos nomes do WhatsApp (ordem da gravação)', () => {
  const r = mapearFaixas(lerPerguntas('A\nB\nC'), [
    audio('WhatsApp Ptt 2026-11-09 at 21.20.00.ogg'),
    audio('WhatsApp Ptt 2026-11-09 at 9.05.00.ogg'),
    audio('WhatsApp Ptt 2026-11-09 at 21.15.03.ogg'),
  ]);
  assert.equal(r.porNumero, false);
  assert.deepEqual(r.faixas.map((f) => f.audio?.nome), [
    'WhatsApp Ptt 2026-11-09 at 9.05.00.ogg',
    'WhatsApp Ptt 2026-11-09 at 21.15.03.ogg',
    'WhatsApp Ptt 2026-11-09 at 21.20.00.ogg',
  ]);
  assert.ok(r.avisos.some((a) => a.includes('ordem')));
});

test('avisa pergunta sem áudio e áudio sobrando', () => {
  const r = mapearFaixas(lerPerguntas('1. A\n2. B'), [audio('1.ogg'), audio('5.ogg')]);
  assert.equal(r.faixas[1].audio, null);
  assert.ok(r.avisos.some((a) => a.includes('5.ogg')));
  assert.ok(r.avisos.some((a) => a.includes('faixa 02')));
});

test('número repetido cai para a ordem', () => {
  const r = mapearFaixas(lerPerguntas('A\nB'), [audio('1 b.ogg'), audio('1 a.ogg')]);
  assert.equal(r.porNumero, false);
  assert.deepEqual(r.faixas.map((f) => f.audio?.nome), ['1 a.ogg', '1 b.ogg']);
});

test('tipos e extensões', () => {
  assert.equal(tipoDoAudio('application/ogg', 'x.ogg'), 'audio/ogg');
  assert.equal(tipoDoAudio('application/octet-stream', 'x.opus'), 'audio/ogg');
  assert.equal(tipoDoAudio('audio/webm;codecs=opus'), 'audio/webm');
  assert.equal(extensao('audio/mp4'), 'm4a');
  assert.equal(extensao('audio/x-m4a'), 'm4a');
  assert.equal(extensao('audio/webm;codecs=opus'), 'webm');
});

test('nome da resposta no Drive', () => {
  assert.equal(nomeDaResposta(4, 'O que ele mais admira na Fernanda?', 'audio/mp4'), '04 - O que ele mais admira na Fernanda.m4a');
  assert.equal(nomeDaResposta(12, 'Casa/praia: qual?', 'audio/webm;codecs=opus', 2), '12 - Casapraia qual (2).webm');
});

test('placar e próxima faixa', () => {
  const res = new Map<number, Resultado>([[1, 'match'], [2, 'sem_match'], [4, 'match']]);
  assert.deepEqual(placar([{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }], res), { match: 2, semMatch: 1, tocadas: 3, total: 4, proxima: 3 });
  assert.equal(placar([{ n: 1 }], new Map([[1, 'match']])).proxima, null);
});

test('frase do fim', () => {
  assert.equal(fraseDoFim(8, 8), 'Conhece o noivo de olhos fechados.');
  assert.equal(fraseDoFim(6, 8), 'Sintonia de casal pronto pro altar.');
  assert.equal(fraseDoFim(1, 8), 'Ainda bem que vocês têm a vida inteira pra se conhecer.');
});

test('tempo e chave', () => {
  assert.equal(tempo(75.9), '1:15');
  assert.equal(tempo(NaN), '0:00');
  assert.equal(chaveDoEndereco('#k=' + 'a1'.repeat(32)), 'a1'.repeat(32));
  assert.equal(chaveDoEndereco('#/faixas&k=' + 'f'.repeat(64)), 'f'.repeat(64));
  assert.equal(chaveDoEndereco('#k=curta'), null);
});
