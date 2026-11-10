import { DATA_CASAMENTO, NOIVO } from '../config';
import { estado } from '../estado';
import { fraseDoFim, placar } from '../regras';
import { go } from '../router';
import { FITA_2, fitaSvg, icone } from '../svg';
import { esc } from '../ui';
import { linhaDoDrive } from './faixas';
import type { TelaApp } from './tipos';

/** A fita do fim. Com recado extra do noivo: a fita 1 até tudo tocar; depois, a troca animada pela fita 2. */
function fitaDoFim(completo: boolean): string {
  const fita1 = fitaSvg({ titulo: `Respostas do ${NOIVO}`, lado: 'A', progresso: 0.9 });
  if (!estado.extras.length) return `<div class="fita-fim">${fitaSvg({ titulo: `O casamento · ${DATA_CASAMENTO}`, lado: '', faixas: ['#D9A441', '#B5542A'], progresso: 0.9 })}</div>`;
  if (!completo) return `<div class="fita-fim">${fita1}</div>`;
  return `<div class="troca" aria-hidden="true">
      <div class="fita-sai">${fita1}</div>
      <div class="fita-entra">${fitaSvg({ titulo: `Recado do ${NOIVO}`, ...FITA_2, progresso: 0.1 })}</div>
    </div>`;
}

const digitos = (n: number) => String(n).split('').map((d) => `<span class="digito grande">${d}</span>`).join('');

export const fim: TelaApp = {
  montar(_r, raiz) {
    if (!estado.faixas.length) return go('', true);
    const p = placar(estado.faixas, estado.resultados);
    const completo = p.proxima === null;
    const fita2 = completo && estado.extras.length > 0;
    raiz.innerHTML = `<section class="tela tela-fim">
      <p class="sobre">FIM DA FITA</p>
      <h1 class="titulo-fim">Deu match em</h1>
      <div class="nota-final" aria-label="${p.match} de ${p.total}">
        <span class="grupo-digitos">${digitos(p.match)}</span>
        <span class="de">de</span>
        <span class="grupo-digitos">${digitos(p.total)}</span>
      </div>
      <p class="texto frase">${esc(fraseDoFim(p.match, p.total))}</p>
      ${fitaDoFim(completo)}
      <div class="mola"></div>
      <p class="status-drive">${esc(linhaDoDrive())}</p>
      ${estado.extras.length && !completo ? `<p class="bonus-lacrado">${icone.cadeado}Fita 2: libera quando todas as faixas tocarem (faltam ${p.total - p.tocadas})</p>` : ''}
      <a class="botao secundario" href="#/faixas">OUVIR UMA FAIXA DE NOVO</a>
      ${fita2
        ? `<a class="botao principal fita2-entra" href="#/bonus">${icone.play}TOCAR A FITA 2</a>`
        : `<a class="botao principal" href="#/">${icone.rebobinar}REBOBINAR TUDO</a>`}
    </section>`;
  },
};
