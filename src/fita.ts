import { tipoDoAudio } from './regras';

// Os dois toca-fitas do app: o do noivo (resposta dele) e o da noiva (a gravação dela).
// Cada um é um <audio> só, criado uma vez: o primeiro toque dentro de um clique libera o som no iPhone para o resto da festa.
// Os .ogg do WhatsApp não tocam em todo iPhone: quando o aparelho não sabe tocar, o app decodifica e entrega um .wav.

export type Lado = 'noivo' | 'noiva';
const players: Record<Lado, HTMLAudioElement> = { noivo: new Audio(), noiva: new Audio() };
const carregado: Record<Lado, string | null> = { noivo: null, noiva: null };
const urls: Record<Lado, string | null> = { noivo: null, noiva: null };
for (const el of Object.values(players)) {
  el.preload = 'auto';
  el.setAttribute('playsinline', '');
}

const decodificados = new Map<string, Blob>();

function forcarDecodificador() {
  try {
    return localStorage.getItem('despedida.decodificar') === '1';
  } catch {
    return false;
  }
}

export interface Parte { blob: Blob; mime: string; nome: string }
interface Pcm { canais: Float32Array[]; taxa: number }

async function decodificar(p: Parte): Promise<Pcm> {
  if (tipoDoAudio(p.mime, p.nome) === 'audio/ogg') {
    const { OggOpusDecoder } = await import('ogg-opus-decoder');
    const dec = new OggOpusDecoder();
    await dec.ready;
    try {
      const r = await dec.decodeFile(new Uint8Array(await p.blob.arrayBuffer()));
      return { canais: r.channelData, taxa: r.sampleRate };
    } finally {
      dec.free();
    }
  }
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(await p.blob.arrayBuffer());
    return { canais: Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i)), taxa: buf.sampleRate };
  } finally {
    ctx.close().catch(() => {});
  }
}

/** Junta as partes numa fita só, com uma pausa curta entre elas (ex.: pergunta-10 + pergunta-10-1). */
function juntar(pcms: Pcm[]): Pcm {
  const taxa = pcms[0].taxa;
  const pausa = Math.round(taxa * 0.4);
  const nCanais = Math.max(...pcms.map((p) => p.canais.length));
  const total = pcms.reduce((s, p) => s + p.canais[0].length, 0) + pausa * (pcms.length - 1);
  const canais = Array.from({ length: nCanais }, () => new Float32Array(total));
  let o = 0;
  for (const p of pcms) {
    for (let c = 0; c < nCanais; c++) canais[c].set(p.canais[Math.min(c, p.canais.length - 1)], o);
    o += p.canais[0].length + pausa;
  }
  return { canais, taxa };
}

async function tocavel(chave: string, partes: Parte[]): Promise<Blob> {
  const pronto = decodificados.get(chave);
  if (pronto) return pronto;
  if (partes.length === 1) {
    const p = partes[0];
    if (tipoDoAudio(p.mime, p.nome) !== 'audio/ogg') return p.blob;
    const sabe = players.noivo.canPlayType('audio/ogg; codecs="opus"');
    if (sabe && !forcarDecodificador()) return new Blob([p.blob], { type: 'audio/ogg' });
  }
  const pcm = juntar(await Promise.all(partes.map(decodificar)));
  const wav = paraWav(pcm.canais, pcm.taxa);
  decodificados.set(chave, wav);
  return wav;
}

/** PCM em .wav de 16 bits (mono se a gravação for mono). */
function paraWav(canais: Float32Array[], taxa: number): Blob {
  const n = canais[0]?.length ?? 0;
  const c = Math.max(1, canais.length);
  const buf = new ArrayBuffer(44 + n * c * 2);
  const v = new DataView(buf);
  const txt = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  txt(0, 'RIFF');
  v.setUint32(4, 36 + n * c * 2, true);
  txt(8, 'WAVE');
  txt(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, c, true);
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * c * 2, true);
  v.setUint16(32, c * 2, true);
  v.setUint16(34, 16, true);
  txt(36, 'data');
  v.setUint32(40, n * c * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++)
    for (let k = 0; k < c; k++) {
      const s = Math.max(-1, Math.min(1, canais[k][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  return new Blob([buf], { type: 'audio/wav' });
}

/** Deixa a fita no ponto, antes de alguém apertar o play (a decodificação acontece enquanto a noiva responde). */
export async function preparar(lado: Lado, chave: string, partes: Parte[]) {
  if (carregado[lado] === chave || !partes.length) return;
  const pronto = await tocavel(chave, partes);
  if (carregado[lado] === chave) return;
  if (urls[lado]) URL.revokeObjectURL(urls[lado]!);
  urls[lado] = URL.createObjectURL(pronto);
  players[lado].src = urls[lado]!;
  players[lado].load();
  carregado[lado] = chave;
}

export const pronta = (lado: Lado, chave: string) => carregado[lado] === chave;
export const player = (lado: Lado) => players[lado];

/** Toca do começo. Chamar dentro do clique, para o navegador deixar sair som. */
export function tocarDoComeco(lado: Lado) {
  pausarTudo();
  const el = players[lado];
  el.currentTime = 0;
  return el.play();
}

export function alternar(lado: Lado) {
  const el = players[lado];
  if (el.paused) {
    pausarTudo();
    if (el.ended) el.currentTime = 0;
    return el.play();
  }
  el.pause();
  return Promise.resolve();
}

export function voltar(lado: Lado, seg = 5) {
  const el = players[lado];
  el.currentTime = Math.max(0, el.currentTime - seg);
}

export function pausarTudo() {
  Object.values(players).forEach((el) => el.pause());
}

/** Avisa a tela a cada mudança de tempo ou de estado das fitas. */
export function aoTocar(fn: () => void) {
  const evs = ['timeupdate', 'play', 'pause', 'ended', 'loadedmetadata', 'durationchange'];
  for (const el of Object.values(players)) evs.forEach((e) => el.addEventListener(e, fn));
  return () => {
    for (const el of Object.values(players)) evs.forEach((e) => el.removeEventListener(e, fn));
  };
}
