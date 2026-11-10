import { DATA_CASAMENTO, NOIVA, NOIVO } from '../config';
import { carregar, estado } from '../estado';
import { fitaSvg, icone } from '../svg';
import { esc, manterTelaAcesa } from '../ui';
import type { TelaApp } from './tipos';

function situacao(): string {
  const e = estado;
  if (e.carga === 'sem_chave')
    return `<p class="nota">Abra pelo link que as madrinhas receberam.</p>`;
  if (e.carga === 'erro')
    return `<p class="nota erro">${esc(e.erro)}</p>
      <button type="button" class="botao secundario" data-acao="tentar">Tentar de novo</button>`;
  if (e.carga === 'carregando') {
    const total = Math.max(1, e.totalAudios);
    const pct = e.totalAudios ? Math.round((e.baixados / total) * 100) : 5;
    return `<div class="carga" role="status">
        <div class="trilho trilho-claro"><span style="width:${pct}%"></span></div>
        <p>${e.totalAudios ? `Rebobinando a fita… ${e.baixados} de ${e.totalAudios}` : 'Buscando a fita no Drive…'}</p>
      </div>
      <button type="button" class="botao principal" disabled>${icone.play}COMEÇAR BRINCADEIRA</button>`;
  }
  return `${e.semDrive ? `<p class="nota">Sem internet agora: usando a fita guardada no aparelho.</p>` : ''}
    <a class="botao principal" href="#/faixas" data-acao="comecar">${icone.play}COMEÇAR BRINCADEIRA</a>`;
}

export const capa: TelaApp = {
  montar(_r, raiz) {
    raiz.innerHTML = `<section class="tela tela-capa">
      <p class="sobre">DESPEDIDA DA ${esc(NOIVA.toUpperCase())} · LADO A</p>
      <h1 class="titulo-capa">O que o noivo respondeu?</h1>
      <div class="fita-capa">${fitaSvg({ titulo: 'Respostas do noivo', gira: true, progresso: 0.2 })}</div>
      <p class="texto">Uma pergunta por vez. A ${esc(NOIVA)} responde primeiro — só depois a fita roda.</p>
      <div class="mola"></div>
      <div class="situacao">${situacao()}</div>
      <p class="rodape">GRAVADO PELO ${esc(NOIVO.toUpperCase())} · LADO B: ${esc(DATA_CASAMENTO)}</p>
    </section>`;
    raiz.querySelector('.tela-capa')!.addEventListener('click', (ev) => {
      const alvo = (ev.target as HTMLElement).closest<HTMLElement>('[data-acao]');
      if (alvo?.dataset.acao === 'tentar') carregar();
      if (alvo?.dataset.acao === 'comecar') {
        sessionStorage.setItem('despedida.acesa', '1');
        manterTelaAcesa();
      }
    });
  },
  atualizar() {
    const el = document.querySelector('.tela-capa .situacao');
    if (el) el.innerHTML = situacao();
  },
};
