import '@fontsource/caveat/latin-500.css';
import '@fontsource/caveat/latin-700.css';
import '@fontsource/special-elite/latin-400.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import './styles.css';

import { NOIVA, NOIVO } from './config';
import * as fita from './fita';
import { ErroDeRede, ponte, usarPonte, type AudioBruto, type ListaBruta } from './ponte';
import { dois, lerPerguntas, mapearFaixas, numeroNoNome, tempo, tipoDoAudio, type AudioInfo, type Resultado } from './regras';
import { fitaSvg, icone, moverFita } from './svg';
import { contador, esc } from './ui';

// Página do noivo (/noivo): com a senha que a noiva criou no fim da brincadeira, ele ouve o lado B dela,
// faixa por faixa, na mesma lista de faixas do app das madrinhas. Também dá pra virar e ouvir o lado A (a resposta dele).

interface FaixaNoivo { n: number; pergunta: string; dele: AudioInfo[]; dela: AudioInfo | null; resultado: Resultado | null }

const SENHA = 'despedida.senhaNoivo';
const lerSenha = () => {
  try {
    return localStorage.getItem(SENHA);
  } catch {
    return null;
  }
};
let senha: string | null = lerSenha();
const guardarSenha = (s: string | null) => {
  senha = s;
  try {
    if (s) localStorage.setItem(SENHA, s);
    else localStorage.removeItem(SENHA);
  } catch {
    /* aba anônima: vale só nesta aba */
  }
};

let faixas: FaixaNoivo[] = [];
let erro: string | null = null;
let carregando = false;
const raiz = document.getElementById('app')!;

/* ---------- dados ---------- */

function montarFaixas(l: ListaBruta): FaixaNoivo[] {
  const { faixas: fs } = mapearFaixas(l.lista ? lerPerguntas(l.lista.texto) : [], l.audios);
  // a gravação mais recente de cada faixa (regravações ficam com "(2)", "(3)" no nome)
  const dela = new Map<number, AudioInfo>();
  for (const r of [...(l.respostas ?? [])].sort((a, b) => a.alterado.localeCompare(b.alterado))) {
    const n = numeroNoNome(r.nome)?.n;
    if (n) dela.set(n, r);
  }
  return fs.map((f) => ({ n: f.n, pergunta: f.pergunta, dele: f.audios, dela: dela.get(f.n) ?? null, resultado: l.resultados?.[String(f.n)] ?? null }));
}

async function entrar(s: string) {
  carregando = true;
  erro = null;
  desenhar();
  try {
    faixas = montarFaixas(await ponte().noivoLista(s));
    guardarSenha(s);
    baixarTudo();
  } catch (e) {
    erro = e instanceof ErroDeRede ? 'Sem conexão. Confira a internet e tente de novo.' : e instanceof Error ? e.message : String(e);
    if (!(e instanceof ErroDeRede)) guardarSenha(null);
  }
  carregando = false;
  desenhar();
}

const blobs = new Map<string, Promise<Blob>>();
function baixar(a: AudioInfo): Promise<Blob> {
  let p = blobs.get(a.id);
  if (!p) {
    p = ponte()
      .noivoAudio(senha ?? '', a.id)
      .then((r: AudioBruto) => {
        const bin = atob(r.base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: tipoDoAudio(r.mime || a.mime, a.nome) });
      });
    p.catch(() => blobs.delete(a.id));
    blobs.set(a.id, p);
  }
  return p;
}

/** Baixa tudo em segundo plano, dois de cada vez: as respostas dela primeiro. */
function baixarTudo() {
  const fila = [...faixas.map((f) => f.dela).filter((a): a is AudioInfo => !!a), ...faixas.flatMap((f) => f.dele)];
  let i = 0;
  const trabalhador = async () => {
    while (i < fila.length) await baixar(fila[i++]).catch(() => {});
  };
  trabalhador();
  trabalhador();
}

const chaveDaFita = (audios: AudioInfo[]) => audios.map((a) => a.id + '@' + a.alterado).join('+');

async function preparar(f: FaixaNoivo, lado: fita.Lado) {
  if (lado === 'noiva') {
    if (!f.dela) return null;
    const blob = await baixar(f.dela);
    await fita.preparar('noiva', f.dela.id, [{ blob, mime: blob.type, nome: f.dela.nome }]);
    return f.dela.id;
  }
  if (!f.dele.length) return null;
  const partes = await Promise.all(f.dele.map(async (a) => ({ blob: await baixar(a), mime: a.mime, nome: a.nome })));
  const chave = chaveDaFita(f.dele);
  await fita.preparar('noivo', chave, partes);
  return chave;
}

/* ---------- telas ---------- */

function telaEntrada(): string {
  return `<section class="tela tela-capa tela-entrada">
    <p class="sobre">LADO B · PRO ${esc(NOIVO.toUpperCase())}</p>
    <h1 class="titulo-capa">O que a noiva respondeu?</h1>
    <div class="fita-capa">${fitaSvg({ titulo: `Respostas da ${NOIVA}`, lado: 'B', lacre: 'LACRADA COM SENHA', progresso: 0.8 })}</div>
    <p class="texto">A ${esc(NOIVA)} lacrou o lado B dela com uma senha. Com a senha, você ouve cada resposta.</p>
    <div class="mola"></div>
    <form class="form-entrada" data-form="entrar" novalidate>
      <label class="rotulo" for="senha-noivo">SENHA DA ${esc(NOIVA.toUpperCase())}</label>
      <input class="campo-senha campo-claro" id="senha-noivo" name="senha" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" required>
      ${erro ? `<p class="nota erro" role="alert">${esc(erro)}</p>` : ''}
      <button type="submit" class="botao principal" ${carregando ? 'disabled' : ''}>${icone.aberto}${carregando ? 'ABRINDO A FITA…' : 'ABRIR O LADO B'}</button>
    </form>
  </section>`;
}

function telaLista(): string {
  const match = faixas.filter((f) => f.resultado === 'match').length;
  const sem = faixas.filter((f) => f.resultado === 'sem_match').length;
  const linhas = faixas
    .map((f) => {
      const selo = !f.dela
        ? `<span class="selo-sem-resposta">SEM RESPOSTA</span>`
        : f.resultado === 'match'
          ? `<span class="selo selo-match" aria-label="Deu match">${icone.check}</span>`
          : f.resultado === 'sem_match'
            ? `<span class="selo selo-sem" aria-label="Não deu match">${icone.x}</span>`
            : `<span class="selo selo-lacrada" aria-label="Ouvir">${icone.play}</span>`;
      return `<a class="faixa ${f.dela ? '' : 'tocada'}" href="#/faixa/${f.n}">
        <span class="faixa-n">${dois(f.n)}</span>
        <span class="faixa-q">${esc(f.pergunta)}</span>
        ${selo}
      </a>`;
    })
    .join('');
  const comResposta = faixas.filter((f) => f.dela).length;
  const primeira = faixas.find((f) => f.dela);
  return `<section class="tela tela-faixas">
    <header class="cabeca-faixas">
      <div>
        <p class="sobre">LADO B · ${esc(NOIVA.toUpperCase())}</p>
        <h1 class="titulo-faixas">Respostas dela</h1>
      </div>
      <div class="contador" aria-label="${comResposta} respostas">${contador(comResposta)}</div>
    </header>
    <nav class="etiqueta lista-faixas" aria-label="Perguntas">
      <div class="listras"><span></span><span></span></div>
      <div class="linhas">${linhas || `<p class="nota">Nenhuma pergunta na fita.</p>`}</div>
    </nav>
    <div class="mola"></div>
    <div class="placar">
      <div class="caixa-placar"><span>MATCH</span><strong>${match}</strong></div>
      <div class="caixa-placar"><span>SEM MATCH</span><strong>${sem}</strong></div>
    </div>
    ${primeira ? `<a class="botao principal" href="#/faixa/${primeira.n}">${icone.play}OUVIR DO COMEÇO</a>` : ''}
  </section>`;
}

let n = 0;
let ativo: fita.Lado = 'noiva';
let soltar: (() => void) | null = null;

function teclas(): string {
  const el = fita.player(ativo);
  const tocando = !el.paused && !el.ended;
  return `<button type="button" class="tecla" data-acao="voltar" aria-label="Voltar 5 segundos">${icone.rebobinar}<span>VOLTAR</span></button>
    <button type="button" class="tecla ${tocando ? 'apertada' : ''}" data-acao="alternar" aria-label="${tocando ? 'Pausar' : 'Tocar'}">${tocando ? icone.pausa : icone.play}<span>${tocando ? 'PAUSAR' : 'TOCAR'}</span></button>
    <button type="button" class="tecla" data-acao="denovo" aria-label="Ouvir de novo">${icone.denovo}<span>DE NOVO</span></button>`;
}

function deckSvg(f: FaixaNoivo) {
  return ativo === 'noiva'
    ? fitaSvg({ titulo: `Resposta da ${NOIVA}`, corpo: 'claro', lado: 'B', progresso: 0, lacre: f.dela ? null : 'ELA NÃO GRAVOU ESTA' })
    : fitaSvg({ titulo: `Resposta do ${NOIVO}`, corpo: 'claro', lado: 'A', progresso: 0, lacre: f.dele.length ? null : 'SEM ÁUDIO NESTA FAIXA' });
}

function telaTocar(f: FaixaNoivo): string {
  const prox = faixas.find((x) => x.n > f.n);
  const res = f.resultado === 'match' ? `${icone.check} Deu match` : f.resultado === 'sem_match' ? `${icone.x} Não deu match` : '';
  return `<section class="tela tela-tocar">
    <header class="topo">
      <span class="ao-vivo"><span class="led" aria-hidden="true"></span><span class="ao-vivo-txt"></span></span>
      <a class="voltar claro" href="#/">${icone.voltar}Faixas</a>
    </header>
    <div class="miolo">
      <div class="coluna-texto"><p class="pergunta clara">${esc(f.pergunta)}</p></div>
      <div class="coluna-deck">
        <div class="deck">${deckSvg(f)}</div>
        <div class="progresso">
          <span id="t-atual">0:00</span>
          <div class="trilho" role="progressbar" aria-label="Andamento da fita" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="barra"></span></div>
          <span id="t-total">0:00</span>
        </div>
        <div class="teclas">${teclas()}</div>
        <button type="button" class="link claro" data-acao="virar"></button>
      </div>
      <div class="coluna-match">
        ${res ? `<p class="resultado-noivo">${res}</p>` : ''}
        ${prox ? `<a class="botao principal" href="#/faixa/${prox.n}">${icone.play}FAIXA ${dois(prox.n)}</a>` : `<a class="botao principal" href="#/">${icone.rebobinar}VOLTAR PRAS FAIXAS</a>`}
      </div>
    </div>
  </section>`;
}

function atualizarDeck() {
  const tela = document.querySelector('.tela-tocar');
  const f = faixas.find((x) => x.n === n);
  if (!tela || !f) return;
  const el = fita.player(ativo);
  const dur = isFinite(el.duration) ? el.duration : 0;
  const p = dur ? el.currentTime / dur : 0;
  const tocando = !el.paused && !el.ended;
  tela.querySelector('#t-atual')!.textContent = tempo(el.currentTime);
  tela.querySelector('#t-total')!.textContent = tempo(dur);
  (tela.querySelector('#barra') as HTMLElement).style.width = `${(p * 100).toFixed(1)}%`;
  const svg = tela.querySelector<SVGSVGElement>('.deck .fita');
  svg?.classList.toggle('gira', tocando);
  moverFita(svg, p);
  tela.querySelector('.ao-vivo')!.classList.toggle('parado', !tocando);
  tela.querySelector('.ao-vivo-txt')!.textContent = `TOCANDO · FAIXA ${dois(n)} · LADO ${ativo === 'noiva' ? 'B' : 'A'}`;
  tela.querySelector('[data-acao="virar"]')!.textContent = ativo === 'noiva' ? `Virar pro lado A (${NOIVO})` : `Virar pro lado B (${NOIVA})`;
  const tk = tela.querySelector('.teclas')!;
  const novo = teclas();
  if (tk.innerHTML !== novo) tk.innerHTML = novo;
  const semAudio = ativo === 'noiva' ? !f.dela : !f.dele.length;
  tk.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = semAudio));
}

/** Prepara o lado e toca (se o navegador barrar o som sem toque, a tecla TOCAR resolve). */
async function tocarLado(f: FaixaNoivo, lado: fita.Lado) {
  fita.pausarTudo();
  ativo = lado;
  const deck = document.querySelector('.tela-tocar .deck');
  if (deck) deck.innerHTML = deckSvg(f);
  atualizarDeck();
  const rota = location.hash;
  const chave = await preparar(f, lado).catch(() => null);
  if (!chave || location.hash !== rota || ativo !== lado) return;
  fita.tocarDoComeco(lado).catch(() => {});
  atualizarDeck();
}

/* ---------- navegação ---------- */

function desenhar() {
  soltar?.();
  soltar = null;
  fita.pausarTudo();
  const m = location.hash.match(/^#\/faixa\/(\d+)/);
  const f = m && faixas.find((x) => x.n === Number(m[1]));
  document.body.dataset.tela = f ? 'tocar' : 'faixas';
  if (!faixas.length) {
    document.body.dataset.tela = 'capa';
    raiz.innerHTML = telaEntrada();
    if (!carregando) raiz.querySelector<HTMLInputElement>('#senha-noivo')?.focus();
    return;
  }
  if (!f) {
    raiz.innerHTML = telaLista();
    return;
  }
  n = f.n;
  ativo = 'noiva';
  raiz.innerHTML = telaTocar(f);
  soltar = fita.aoTocar(atualizarDeck);
  tocarLado(f, 'noiva');
  window.scrollTo(0, 0);
}

raiz.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const s = (ev.target as HTMLFormElement).querySelector<HTMLInputElement>('#senha-noivo')?.value.trim() ?? '';
  if (s) entrar(s);
});
raiz.addEventListener('click', (ev) => {
  const acao = (ev.target as HTMLElement).closest<HTMLElement>('[data-acao]')?.dataset.acao;
  const f = faixas.find((x) => x.n === n);
  if (!acao || !f || !document.querySelector('.tela-tocar')) return;
  if (acao === 'alternar') fita.alternar(ativo).catch(() => {});
  else if (acao === 'voltar') fita.voltar(ativo, 5);
  else if (acao === 'denovo') fita.tocarDoComeco(ativo).catch(() => {});
  else if (acao === 'virar') tocarLado(f, ativo === 'noiva' ? 'noivo' : 'noiva');
});
window.addEventListener('hashchange', desenhar);

async function iniciar() {
  if (import.meta.env.VITE_MOCK === '1') {
    const { ponteDeTeste } = await import('./mock');
    usarPonte(ponteDeTeste);
    (window as unknown as { __fita: unknown }).__fita = fita;
  }
  desenhar();
  if (senha) await entrar(senha);
}
iniciar();
