import type { Rota } from '../router';

export interface TelaApp {
  montar(rota: Rota, raiz: HTMLElement): void;
  /** O estado mudou (carga, fila, placar). Sem isto, a tela é montada de novo. */
  atualizar?(): void;
  desmontar?(): void;
}
