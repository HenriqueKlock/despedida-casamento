import { DATA_CASAMENTO, NOIVO } from '../config';
import { estado } from '../estado';
import { fraseDoFim, placar } from '../regras';
import { go } from '../router';
import { FITA_2, fitaSvg, icone } from '../svg';
import { esc } from '../ui';
import { avisoDoDrive } from './faixas';
import type { TelaApp } from './tipos';

// A troca animada (fita 1 sai, fita 2 entra) acontece uma vez só. Nas próximas visitas, a fita 2 já está no lugar
// e o botão aparece na hora. Zerar o placar faz a troca acontecer de novo.
const TROCA = 'despedida.trocaVista';
const trocaVista = () => {
  try {
    return localStorage.getItem(TROCA) === '1';
  } catch {
    return false;
  }
};
const marcarTroca = () => {
  try {
    localStorage.setItem(TROCA, '1');
  } catch {
    /* sem armazenamento: anima de novo na próxima visita */
  }
};
export const esquecerTroca = () => {
  try {
    localStorage.removeItem(TROCA);
  } catch {
    /* nada a esquecer */
  }
};

/** A fita do fim. Com recado extra do noivo: a fita 1 até tudo tocar; depois, a fita 2 (com a troca animada na primeira vez). */
function fitaDoFim(completo: boolean, animar: boolean): string {
  const fita1 = fitaSvg({ titulo: `Respostas do ${NOIVO}`, lado: 'A', progresso: 0.9 });
  if (!estado.extras.length) return `<div class="fita-fim">${fitaSvg({ titulo: `O casamento · ${DATA_CASAMENTO}`, lado: '', faixas: ['#D9A441', '#B5542A'], progresso: 0.9 })}</div>`;
  if (!completo) return `<div class="fita-fim">${fita1}</div>`;
  if (!animar) return `<div class="fita-fim">${fitaSvg({ titulo: `Recado do ${NOIVO}`, ...FITA_2, progresso: 0.1 })}</div>`;
  return `<div class="troca" aria-hidden="true">
      <div class="fita-sai">${fita1}</div>
      <div class="fita-entra">${fitaSvg({ titulo: `Recado do ${NOIVO}`, ...FITA_2, progresso: 0.1 })}</div>
    </div>`;
}

const avisoFim = () => (avisoDoDrive() ? `<p class="status-drive">${esc(avisoDoDrive())}</p>` : '');

const digitos = (n: number) => String(n).split('').map((d) => `<span class="digito grande">${d}</span>`).join('');

export const fim: TelaApp = {
  montar(_r, raiz) {
    if (!estado.faixas.length) return go('', true);
    const p = placar(estado.faixas, estado.resultados);
    const completo = p.proxima === null;
    const fita2 = completo && estado.extras.length > 0;
    const animar = fita2 && !trocaVista();
    if (animar) marcarTroca();
    raiz.innerHTML = `<section class="tela tela-fim">
      <p class="sobre">FIM DA FITA</p>
      <h1 class="titulo-fim">Deu match em</h1>
      <div class="nota-final" aria-label="${p.match} de ${p.total}">
        <span class="grupo-digitos">${digitos(p.match)}</span>
        <span class="de">de</span>
        <span class="grupo-digitos">${digitos(p.total)}</span>
      </div>
      <p class="texto frase">${esc(fraseDoFim(p.match, p.total))}</p>
      ${fitaDoFim(completo, animar)}
      <div class="mola"></div>
      <div class="aviso-fim">${avisoFim()}</div>
      ${estado.extras.length && !completo ? `<p class="bonus-lacrado">${icone.cadeado}Fita 2: libera quando todas as faixas tocarem (faltam ${p.total - p.tocadas})</p>` : ''}
      <a class="botao secundario" href="#/faixas">OUVIR UMA FAIXA DE NOVO</a>
      ${fita2
        ? `<a class="botao principal ${animar ? 'fita2-entra' : ''}" href="#/bonus">${icone.play}TOCAR A FITA 2</a>`
        : `<a class="botao principal" href="#/">${icone.rebobinar}REBOBINAR TUDO</a>`}
    </section>`;
  },
  // mudanças em segundo plano (uma resposta subindo pro Drive) não redesenham a tela nem reiniciam a animação
  atualizar() {
    const el = document.querySelector('.tela-fim .aviso-fim');
    if (el) el.innerHTML = avisoFim();
  },
};
