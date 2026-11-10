import { NOIVA, NOIVO } from '../config';
import { audiosBonus, audiosDoNoivo, chaveDaFita, estado, faixa, marcar } from '../estado';
import * as fita from '../fita';
import { dois, placar, tempo, type AudioInfo, type Resultado } from '../regras';
import { go, type Rota } from '../router';
import { fitaSvg, icone, moverFita } from '../svg';
import { esc } from '../ui';
import type { TelaApp } from './tipos';

// A fita do noivo tocando no deck. Depois, a madrinha marca se deu match.
// #/bonus usa o mesmo deck para a faixa bônus (áudios sem número), sem placar.

let n = 0;
let bonus = false;
let ativo: fita.Lado = 'noivo';
let soltar: (() => void) | null = null;

function teclas(): string {
  const el = fita.player(ativo);
  const tocando = !el.paused && !el.ended;
  return `<button type="button" class="tecla" data-acao="voltar" aria-label="Voltar 5 segundos">${icone.rebobinar}<span>VOLTAR</span></button>
    <button type="button" class="tecla ${tocando ? 'apertada' : ''}" data-acao="alternar" aria-label="${tocando ? 'Pausar' : 'Tocar'}">${tocando ? icone.pausa : icone.play}<span>${tocando ? 'PAUSAR' : 'TOCAR'}</span></button>
    <button type="button" class="tecla" data-acao="denovo" aria-label="Ouvir de novo">${icone.denovo}<span>DE NOVO</span></button>`;
}

function atualizarDeck() {
  const tela = document.querySelector('.tela-tocar');
  if (!tela) return;
  const el = fita.player(ativo);
  const dur = isFinite(el.duration) ? el.duration : 0;
  const p = dur ? el.currentTime / dur : 0;
  const tocando = !el.paused && !el.ended;
  tela.querySelector('#t-atual')!.textContent = tempo(el.currentTime);
  tela.querySelector('#t-total')!.textContent = tempo(dur);
  (tela.querySelector('#barra') as HTMLElement).style.width = `${(p * 100).toFixed(1)}%`;
  tela.querySelector('.trilho')!.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  const svg = tela.querySelector<SVGSVGElement>('.deck .fita');
  svg?.classList.toggle('gira', tocando);
  moverFita(svg, p);
  tela.querySelector('.ao-vivo')!.classList.toggle('parado', !tocando);
  const tk = tela.querySelector('.teclas')!;
  const novo = teclas();
  if (tk.innerHTML !== novo) tk.innerHTML = novo;
}

function trocarLado(lado: fita.Lado) {
  fita.pausarTudo();
  ativo = lado;
  const tela = document.querySelector('.tela-tocar');
  const t = tela?.querySelector('.deck .fita text');
  if (t) t.textContent = lado === 'noiva' ? `Resposta da ${NOIVA}` : `Resposta do ${NOIVO}`;
  const link = tela?.querySelector('[data-acao="ouvir-dela"]');
  if (link) link.textContent = lado === 'noiva' ? 'Voltar pra fita do noivo' : 'Ouvir a resposta dela';
}

async function clique(ev: Event) {
  const acao = (ev.target as HTMLElement).closest<HTMLElement>('[data-acao]')?.dataset.acao;
  if (!acao) return;
  if (acao === 'alternar') fita.alternar(ativo).catch(() => {});
  else if (acao === 'voltar') fita.voltar(ativo, 5);
  else if (acao === 'denovo') fita.tocarDoComeco(ativo).catch(() => {});
  else if (acao === 'ouvir-dela') {
    const g = estado.gravacoes.get(n);
    if (ativo === 'noiva' || !g) trocarLado('noivo');
    else if (fita.pronta('noiva', g.id)) {
      trocarLado('noiva');
      fita.tocarDoComeco('noiva').catch(() => {});
    }
    atualizarDeck();
  } else if (acao === 'match' || acao === 'sem_match') {
    fita.pausarTudo();
    await marcar(n, acao as Resultado);
    go(placar(estado.faixas, estado.resultados).proxima === null ? 'fim' : 'faixas');
  }
}

function botoesMatch(): string {
  const r = estado.resultados.get(n);
  return `<button type="button" class="botao match" data-acao="match" aria-pressed="${r === 'match'}">${icone.check}DEU MATCH</button>
    <button type="button" class="botao sem-match" data-acao="sem_match" aria-pressed="${r === 'sem_match'}">${icone.x}NÃO DEU MATCH</button>`;
}

/** Deixa a fita pronta e tenta tocar (se o navegador barrar, a tecla TOCAR resolve). */
function carregarETocar(audios: AudioInfo[], buscar: () => Promise<fita.Parte[]>) {
  const chave = chaveDaFita(audios);
  if (!audios.length || fita.pronta('noivo', chave)) return;
  const rota = location.hash;
  buscar().then(async (partes) => {
    await fita.preparar('noivo', chave, partes);
    if (location.hash !== rota) return;
    fita.tocarDoComeco('noivo').catch(() => {});
    atualizarDeck();
  });
}

export const tocar: TelaApp = {
  montar(r: Rota, raiz) {
    bonus = r.tela === 'bonus';
    const f = bonus ? null : r.n ? faixa(r.n) : null;
    if (bonus ? !estado.extras.length : !f) return go(estado.faixas.length ? 'faixas' : '', true);
    n = f?.n ?? 0;
    ativo = 'noivo';
    const audios = bonus ? estado.extras : f!.audios;
    const dela = bonus ? undefined : estado.gravacoes.get(n);
    raiz.innerHTML = `<section class="tela tela-tocar">
      <header class="topo">
        <span class="ao-vivo"><span class="led" aria-hidden="true"></span>TOCANDO · ${bonus ? 'FAIXA BÔNUS' : `FAIXA ${dois(n)}`}</span>
        <a class="voltar claro" href="${bonus ? '#/fim' : '#/faixas'}">${icone.voltar}${bonus ? 'Placar' : 'Faixas'}</a>
      </header>
      <div class="miolo">
        <div class="coluna-texto">
          <p class="pergunta clara">${bonus ? `Um recado do ${esc(NOIVO)} pra ${esc(NOIVA)}` : esc(f!.pergunta)}</p>
        </div>
        <div class="coluna-deck">
          <div class="deck">${fitaSvg({ titulo: bonus ? `Recado do ${NOIVO}` : `Resposta do ${NOIVO}`, corpo: 'claro', progresso: 0, lado: bonus ? 'B' : 'A', lacre: audios.length ? null : 'SEM ÁUDIO NESTA FAIXA' })}</div>
          <div class="progresso">
            <span id="t-atual">0:00</span>
            <div class="trilho" role="progressbar" aria-label="Andamento da fita" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="barra"></span></div>
            <span id="t-total">0:00</span>
          </div>
          <div class="teclas">${teclas()}</div>
          ${dela ? `<button type="button" class="link claro" data-acao="ouvir-dela">Ouvir a resposta dela</button>` : ''}
        </div>
        ${bonus ? '' : `<div class="coluna-match">
          <p class="pergunta-match">E aí, deu match?</p>
          <div class="duas">${botoesMatch()}</div>
        </div>`}
      </div>
    </section>`;
    const tela = raiz.querySelector<HTMLElement>('.tela-tocar')!;
    tela.addEventListener('click', clique);
    if (!audios.length) tela.querySelectorAll<HTMLButtonElement>('.teclas button').forEach((b) => (b.disabled = true));
    soltar = fita.aoTocar(atualizarDeck);
    atualizarDeck();
    if (dela) fita.preparar('noiva', dela.id, [dela]).catch(() => {});
    carregarETocar(audios, bonus ? audiosBonus : () => audiosDoNoivo(n));
  },
  atualizar() {
    const d = document.querySelector('.tela-tocar .duas');
    if (d) d.innerHTML = botoesMatch();
  },
  desmontar() {
    soltar?.();
    soltar = null;
    fita.pausarTudo();
  },
};
