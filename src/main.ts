import '@fontsource/caveat/latin-500.css';
import '@fontsource/caveat/latin-700.css';
import '@fontsource/special-elite/latin-400.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import './styles.css';

import { registerSW } from 'virtual:pwa-register';
import { aoMudar, carregar, carregarDoAparelho, iniciarFila } from './estado';
import { guardarChave, usarPonte } from './ponte';
import { chaveDoEndereco } from './regras';
import { parse, type Tela } from './router';
import { capa } from './screens/capa';
import { faixas } from './screens/faixas';
import { fim } from './screens/fim';
import { pergunta } from './screens/pergunta';
import { tocar } from './screens/tocar';
import type { TelaApp } from './screens/tipos';

registerSW({ immediate: true });

const telas: Record<Tela, TelaApp> = { capa, faixas, faixa: pergunta, tocar, bonus: tocar, fim };
const raiz = document.getElementById('app')!;
let atual: TelaApp | null = null;

function mostrar() {
  const r = parse();
  atual?.desmontar?.();
  atual = telas[r.tela];
  document.body.dataset.tela = r.tela;
  atual.montar(r, raiz);
  window.scrollTo(0, 0);
}

async function iniciar() {
  if (import.meta.env.VITE_MOCK === '1') {
    const { ponteDeTeste } = await import('./mock');
    usarPonte(ponteDeTeste);
    (window as unknown as { __fita: unknown }).__fita = await import('./fita');
  }
  // o link das madrinhas traz a chave (#k=…): guarda no aparelho e tira do endereço, para não aparecer na tela
  const k = chaveDoEndereco(location.hash);
  if (k) {
    guardarChave(k);
    history.replaceState(null, '', location.pathname + location.search + '#/');
  }
  await carregarDoAparelho();
  aoMudar(() => (atual?.atualizar ? atual.atualizar() : atual && atual.montar(parse(), raiz)));
  window.addEventListener('hashchange', mostrar);
  mostrar();
  iniciarFila();
  await carregar();
}
iniciar();
