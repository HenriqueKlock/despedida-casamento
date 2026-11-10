import { DATA_CASAMENTO } from '../config';
import { estado } from '../estado';
import { fraseDoFim, placar } from '../regras';
import { go } from '../router';
import { fitaSvg, icone } from '../svg';
import { esc } from '../ui';
import { linhaDoDrive } from './faixas';
import type { TelaApp } from './tipos';

const digitos = (n: number) => String(n).split('').map((d) => `<span class="digito grande">${d}</span>`).join('');

export const fim: TelaApp = {
  montar(_r, raiz) {
    if (!estado.faixas.length) return go('', true);
    const p = placar(estado.faixas, estado.resultados);
    raiz.innerHTML = `<section class="tela tela-fim">
      <p class="sobre">FIM DO LADO A</p>
      <h1 class="titulo-fim">Deu match em</h1>
      <div class="nota-final" aria-label="${p.match} de ${p.total}">
        <span class="grupo-digitos">${digitos(p.match)}</span>
        <span class="de">de</span>
        <span class="grupo-digitos">${digitos(p.total)}</span>
      </div>
      <p class="texto frase">${esc(fraseDoFim(p.match, p.total))}</p>
      <div class="fita-fim">${fitaSvg({ titulo: `O casamento · ${DATA_CASAMENTO}`, lado: 'B', faixas: ['#D9A441', '#B5542A'], progresso: 0.9 })}</div>
      <div class="mola"></div>
      <p class="status-drive">${esc(linhaDoDrive())}</p>
      <a class="botao secundario" href="#/faixas">OUVIR UMA FAIXA DE NOVO</a>
      <a class="botao principal" href="#/">${icone.rebobinar}REBOBINAR TUDO</a>
    </section>`;
  },
};
