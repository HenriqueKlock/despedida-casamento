import Dexie, { type Table } from 'dexie';
import type { Resultado } from './regras';
import type { ListaBruta } from './ponte';

// Tudo que o app precisa na festa fica no aparelho: a lista, os áudios do noivo, as respostas da noiva e o placar.
// Assim, depois de carregada uma vez, a fita toca mesmo se o Wi-Fi cair.

export interface AudioGuardado { id: string; alterado: string; nome: string; mime: string; blob: Blob }
export interface Gravacao {
  /** id gerado no aparelho: a ponte usa para não duplicar quando a fila reenvia */
  id: string;
  faixa: number;
  nome: string;
  mime: string;
  blob: Blob;
  criado: number;
  enviada: 0 | 1;
  erro?: string;
}
export interface Marcacao {
  faixa: number;
  id: string;
  resultado: Resultado;
  pergunta: string;
  resposta: string | null;
  quando: number;
  enviada: 0 | 1;
  erro?: string;
}

class Banco extends Dexie {
  lista!: Table<ListaBruta & { chave: string; carregada: number }, string>;
  audios!: Table<AudioGuardado, string>;
  gravacoes!: Table<Gravacao, string>;
  marcacoes!: Table<Marcacao, number>;
  constructor() {
    super('despedida-casamento');
    this.version(1).stores({
      lista: 'chave',
      audios: 'id',
      gravacoes: 'id, faixa, criado, enviada',
      marcacoes: 'faixa, enviada',
    });
  }
}
export const db = new Banco();

/** Última gravação de cada faixa. */
export async function gravacoesPorFaixa(): Promise<Map<number, Gravacao>> {
  const todas = await db.gravacoes.orderBy('criado').toArray();
  return new Map(todas.map((g) => [g.faixa, g]));
}
