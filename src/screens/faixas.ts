import { estado, zerarPlacar } from '../estado';
import { dois, placar } from '../regras';
import { go } from '../router';
import { icone } from '../svg';
import { contador, esc } from '../ui';
import type { TelaApp } from './tipos';

export function linhaDoDrive(): string {
  const e = estado;
  const partes = [`Respostas no Drive: ${e.respostasNoDrive}`];
  if (e.naFila) partes.push(`${e.naFila} na fila`);
  if (e.recusadas) partes.push(`${e.recusadas} recusada(s)`);
  return partes.join(' · ');
}

let zerarArmado = 0;

function html(): string {
  const e = estado;
  const p = placar(e.faixas, e.resultados);
  const linhas = e.faixas
    .map((f) => {
      const r = e.resultados.get(f.n);
      const atual = !r && f.n === p.proxima;
      const destino = r ? `#/tocar/${f.n}` : `#/faixa/${f.n}`;
      const marca =
        r === 'match'
          ? `<span class="selo selo-match" aria-label="Deu match">${icone.check}</span>`
          : r === 'sem_match'
            ? `<span class="selo selo-sem" aria-label="Não deu match">${icone.x}</span>`
            : atual
              ? `<span class="selo-tocar">TOCAR</span>`
              : `<span class="selo selo-lacrada" aria-label="Lacrada">${icone.cadeado}</span>`;
      return `<a class="faixa ${atual ? 'atual' : ''} ${r ? 'tocada' : ''}" href="${destino}">
        <span class="faixa-n">${dois(f.n)}</span>
        <span class="faixa-q">${esc(f.pergunta)}</span>
        ${marca}
      </a>`;
    })
    .join('');
  const principal =
    p.proxima !== null
      ? `<a class="botao principal" href="#/faixa/${p.proxima}">${icone.play}FAIXA ${dois(p.proxima)}</a>`
      : `<a class="botao principal" href="#/fim">${icone.play}VER O PLACAR</a>`;
  const avisos = e.avisos.length
    ? `<details class="conferencia"><summary>Conferência da fita (${e.avisos.length})</summary><ul>${e.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></details>`
    : '';
  return `<section class="tela tela-faixas">
    <header class="cabeca-faixas">
      <div>
        <p class="sobre">FITA DA DESPEDIDA</p>
        <h1 class="titulo-faixas">Faixas</h1>
      </div>
      <div class="contador" aria-label="${p.tocadas} de ${p.total} faixas tocadas">${contador(p.tocadas)}<span class="barra-contador">/</span>${contador(p.total)}</div>
    </header>
    <nav class="etiqueta lista-faixas" aria-label="Perguntas">
      <div class="listras"><span></span><span></span></div>
      <div class="linhas">${linhas || `<p class="nota">Nenhuma pergunta na fita ainda.</p>`}</div>
    </nav>
    <div class="mola"></div>
    <div class="placar">
      <div class="caixa-placar"><span>MATCH</span><strong>${p.match}</strong></div>
      <div class="caixa-placar"><span>SEM MATCH</span><strong>${p.semMatch}</strong></div>
    </div>
    ${principal}
    <div class="rodape-faixas">
      <a class="link" href="#/fim">Encerrar a fita e ver o placar</a>
      <p class="status-drive">${esc(linhaDoDrive())}${e.semDrive ? ' · sem internet' : ''}</p>
      ${p.tocadas ? `<button type="button" class="link link-pequeno" data-acao="zerar">${zerarArmado > Date.now() ? 'Toque de novo pra zerar o placar' : 'Zerar placar'}</button>` : ''}
      ${avisos}
    </div>
  </section>`;
}

export const faixas: TelaApp = {
  montar(_r, raiz) {
    if (estado.carga !== 'pronta' && !estado.faixas.length) return go('', true);
    const aberto = raiz.querySelector<HTMLDetailsElement>('.conferencia')?.open;
    raiz.innerHTML = html();
    if (aberto) raiz.querySelector<HTMLDetailsElement>('.conferencia')!.open = true;
    raiz.querySelector('[data-acao="zerar"]')?.addEventListener('click', async () => {
      if (zerarArmado > Date.now()) {
        zerarArmado = 0;
        await zerarPlacar();
      } else {
        zerarArmado = Date.now() + 4000;
        faixas.montar(_r, raiz);
        setTimeout(() => document.querySelector('.tela-faixas') && faixas.montar(_r, raiz), 4100);
      }
    });
  },
};
