// Pequenos utilitários de tela.

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const $ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) => raiz.querySelector<T>(sel);

/** Mostra o número no contador mecânico: 3 → [0][3]. */
export const contador = (n: number) =>
  String(Math.max(0, n)).padStart(2, '0').split('').map((d) => `<span class="digito">${d}</span>`).join('');

let avisoT: number | undefined;
export function avisar(msg: string) {
  let el = document.getElementById('aviso');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aviso';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('visivel');
  clearTimeout(avisoT);
  avisoT = window.setTimeout(() => el!.classList.remove('visivel'), 3500);
}

/** Mantém a tela acesa durante a brincadeira (quando o aparelho deixa). */
let trava: { release(): Promise<void> } | null = null;
export async function manterTelaAcesa() {
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
    if (wl && !trava) {
      trava = await wl.request('screen');
      (trava as unknown as EventTarget).addEventListener?.('release', () => (trava = null));
    }
  } catch {
    /* sem suporte: segue normal */
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && sessionStorage.getItem('despedida.acesa')) manterTelaAcesa();
});
