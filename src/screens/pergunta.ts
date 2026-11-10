import { NOIVA, NOIVO } from '../config';
import { audiosDoNoivo, carregar, chaveDaFita, estado, faixa, guardarResposta } from '../estado';
import * as fita from '../fita';
import { gravar, podeGravar, type Gravacao } from '../gravador';
import { paraMp3 } from '../mp3';
import { dois, tempo } from '../regras';
import { go, type Rota } from '../router';
import { fitaSvg, icone } from '../svg';
import { avisar, esc } from '../ui';
import type { TelaApp } from './tipos';

// Pergunta com a fita lacrada. A madrinha grava a resposta da noiva; só depois a fita do noivo destrava.

type Modo = 'inicial' | 'gravando' | 'guardando' | 'gravada' | 'muda' | 'sem_mic';
let n = 0;
let modo: Modo = 'inicial';
let rec: Gravacao | null = null;
let relogio: number | undefined;
let ouviuAlgo = false;

function painel(): string {
  if (modo === 'gravando')
    return `<div class="rec" role="status">
        <span class="luz-rec" aria-hidden="true"></span><span class="rec-txt">REC · LADO B</span>
        <span class="cronometro" id="cronometro">0:00</span>
        <span class="leds" aria-hidden="true">${'<i></i>'.repeat(8)}</span>
      </div>
      <p class="aviso-mic" id="aviso-mic" hidden></p>
      <button type="button" class="botao parar" data-acao="parar">${icone.parar}ELA TERMINOU</button>
      <button type="button" class="link" data-acao="cancelar">Cancelar gravação</button>`;
  if (modo === 'guardando') return `<p class="texto" role="status">Guardando a gravação…</p>`;
  if (modo === 'muda')
    return `<p class="texto">A gravação saiu sem som. Confira se o microfone certo está liberado no navegador (ícone de microfone na barra de endereço) e grave de novo.</p>
      <button type="button" class="botao gravar" data-acao="gravar">${icone.rec}GRAVAR DE NOVO</button>`;
  if (modo === 'gravada')
    return `<p class="texto ok">${icone.check} ${estado.gravacoes.get(n)?.enviada ? 'Lado B gravado e salvo no Drive.' : 'Lado B gravado. Vai pro Drive sozinho.'}</p>
      <div class="linha-links">
        <button type="button" class="link" data-acao="ouvir-dela">Ouvir</button>
        <button type="button" class="link" data-acao="gravar">Regravar</button>
      </div>
      <button type="button" class="botao principal" data-acao="liberar">${icone.aberto}ELA RESPONDEU · LIBERAR</button>`;
  if (modo === 'sem_mic')
    return `<p class="texto">Não deu pra usar o microfone. Permita o microfone pra este site no navegador (ícone na barra de endereço) e tente de novo. A fita só destrava depois da resposta gravada.</p>
      <button type="button" class="botao gravar" data-acao="gravar">${icone.rec}TENTAR DE NOVO</button>`;
  return `<p class="texto">${esc(NOIVA)}, responde em voz alta. A gente grava, e a fita só destrava depois da sua resposta.</p>
    <button type="button" class="botao gravar" data-acao="gravar">${icone.rec}GRAVAR A RESPOSTA DELA</button>`;
}

/** Lado A: a resposta dele, lacrada. Enquanto grava, a fita mostra o lado B: a resposta dela. */
function fitaDaPergunta(): string {
  return modo === 'gravando'
    ? fitaSvg({ titulo: `Resposta da ${NOIVA}`, lado: 'B', gira: true, progresso: 0.1 })
    : fitaSvg({ titulo: `Resposta do ${NOIVO}`, lado: 'A', lacre: 'LACRADA ATÉ ELA RESPONDER', progresso: 0.1 });
}

function desenharPainel() {
  const el = document.querySelector('.tela-pergunta .painel');
  if (el) el.innerHTML = painel();
  const f = document.querySelector('.tela-pergunta .fita-pergunta');
  if (f) f.innerHTML = fitaDaPergunta();
}

function pararRelogio() {
  clearInterval(relogio);
  relogio = undefined;
}

async function comecarGravacao() {
  if (!podeGravar()) {
    modo = 'sem_mic';
    return desenharPainel();
  }
  fita.pausarTudo();
  try {
    rec = await gravar();
  } catch {
    modo = 'sem_mic';
    return desenharPainel();
  }
  modo = 'gravando';
  ouviuAlgo = false;
  desenharPainel();
  relogio = window.setInterval(() => {
    if (!rec) return;
    const c = document.getElementById('cronometro');
    if (c) c.textContent = tempo((Date.now() - rec.inicio) / 1000);
    const nivel = rec.nivel();
    document.querySelectorAll<HTMLElement>('.leds i').forEach((led, i) => led.classList.toggle('aceso', nivel > (i + 0.5) / 8));
    if (nivel > 0.05) ouviuAlgo = true;
    const aviso = document.getElementById('aviso-mic');
    if (aviso) {
      const msg = rec.cortado()
        ? 'O microfone foi cortado pelo aparelho.'
        : !ouviuAlgo && Date.now() - rec.inicio > 4000
          ? 'Não estou ouvindo nada. Confira o microfone.'
          : '';
      aviso.hidden = !msg;
      aviso.textContent = msg;
    }
  }, 120);
}

async function pararGravacao() {
  if (!rec) return;
  const r = rec;
  rec = null;
  pararRelogio();
  modo = 'guardando';
  desenharPainel();
  try {
    const gravado = await r.parar();
    // MP3 toca em qualquer lugar; se este aparelho não conseguir converter, guarda o original
    const mp3 = await paraMp3(gravado.blob).catch(() => null);
    if (mp3 && !mp3.temSom) {
      modo = 'muda';
      return desenharPainel();
    }
    await guardarResposta(n, mp3 ? mp3.blob : gravado.blob, mp3 ? 'audio/mpeg' : gravado.mime);
    prepararDela();
    modo = 'gravada';
  } catch (e) {
    avisar(e instanceof Error ? e.message : 'Não deu pra salvar a gravação');
    modo = 'inicial';
  }
  desenharPainel();
}

function prepararDela() {
  const g = estado.gravacoes.get(n);
  if (g) fita.preparar('noiva', g.id, [g]).catch(() => {});
}

async function prepararDele() {
  const f = faixa(n);
  if (!f?.audios.length) return;
  await fita.preparar('noivo', chaveDaFita(f.audios), await audiosDoNoivo(n)).catch(() => {});
}

function liberar() {
  // só destrava com a resposta dela gravada
  if (!estado.gravacoes.has(n)) return;
  const f = faixa(n);
  // dentro do clique: o navegador deixa a fita do noivo começar a tocar
  if (f?.audios.length && fita.pronta('noivo', chaveDaFita(f.audios))) fita.tocarDoComeco('noivo').catch(() => {});
  go(`tocar/${n}`);
}

async function clique(ev: Event) {
  const acao = (ev.target as HTMLElement).closest<HTMLElement>('[data-acao]')?.dataset.acao;
  if (acao === 'gravar') comecarGravacao();
  else if (acao === 'parar') pararGravacao();
  else if (modo === 'guardando') return;
  else if (acao === 'cancelar') {
    rec?.cancelar();
    rec = null;
    pararRelogio();
    modo = estado.gravacoes.has(n) ? 'gravada' : 'inicial';
    desenharPainel();
  } else if (acao === 'liberar') liberar();
  else if (acao === 'ouvir-dela') {
    const g = estado.gravacoes.get(n);
    if (g && fita.pronta('noiva', g.id)) fita.alternar('noiva').catch(() => {});
  }
}

export const pergunta: TelaApp = {
  montar(r: Rota, raiz) {
    const f = r.n ? faixa(r.n) : null;
    if (!f) return go(estado.faixas.length ? 'faixas' : '', true);
    n = f.n;
    modo = estado.gravacoes.has(n) ? 'gravada' : 'inicial';
    raiz.innerHTML = `<section class="tela tela-pergunta">
      <header class="topo">
        <a class="voltar" href="#/faixas">${icone.voltar}Faixas</a>
        <span class="sobre">FAIXA ${dois(n)} / ${dois(estado.faixas.length)}</span>
      </header>
      <div class="miolo">
        <div class="cartao"><p class="rotulo">PERGUNTA</p><p class="pergunta">${esc(f.pergunta)}</p></div>
        <div class="lado-fita">
          <div class="fita-pergunta">${fitaDaPergunta()}</div>
          <div class="painel">${painel()}</div>
        </div>
      </div>
    </section>`;
    raiz.querySelector('.tela-pergunta')!.addEventListener('click', clique);
    prepararDele();
    prepararDela();
    carregar(); // confere no Drive se a resposta dela ainda está lá
  },
  atualizar() {
    // durante a gravação nada muda na tela; fora dela, o Drive decide se a faixa já tem a resposta dela
    if (modo !== 'inicial' && modo !== 'gravada') return;
    modo = estado.gravacoes.has(n) ? 'gravada' : 'inicial';
    desenharPainel();
    prepararDela();
  },
  desmontar() {
    rec?.cancelar();
    rec = null;
    pararRelogio();
    fita.player('noiva').pause();
  },
};
