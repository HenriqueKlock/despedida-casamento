// Navegação por endereço: o voltar do celular funciona e recarregar a página mantém a tela.
// #/ capa · #/faixas · #/faixa/4 (pergunta lacrada) · #/tocar/4 (fita do noivo) · #/fim

export type Tela = 'capa' | 'faixas' | 'faixa' | 'tocar' | 'fim';
export interface Rota { tela: Tela; n: number | null }

export function parse(hash = location.hash): Rota {
  const [t, n] = hash.replace(/^#\/?/, '').split(/[&]/)[0].split('/');
  const num = Number(n);
  if ((t === 'faixa' || t === 'tocar') && num > 0) return { tela: t, n: num };
  if (t === 'faixas' || t === 'fim') return { tela: t, n: null };
  return { tela: 'capa', n: null };
}

export function go(caminho: string, substituir = false) {
  const h = '#/' + caminho.replace(/^#?\/?/, '');
  if (location.hash === h) return;
  if (substituir) {
    history.replaceState(history.state, '', h);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else location.hash = h;
}
