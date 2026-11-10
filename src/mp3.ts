// Converte a gravação da noiva para MP3, que toca em qualquer lugar (Drive, Windows, iPhone, WhatsApp).
// Cada navegador grava num formato próprio (o Chrome chega a pôr Opus dentro de .m4a, que quase nenhum player toca),
// então o app decodifica o que foi gravado e reencoda. No caminho, confere se tem som e sobe o volume se ficou baixo.

export interface Mp3 { blob: Blob; temSom: boolean; segundos: number }

type CtxCtor = typeof AudioContext;
const Ctx = (): CtxCtor | undefined => window.AudioContext ?? (window as unknown as { webkitAudioContext?: CtxCtor }).webkitAudioContext;

/** null = este aparelho não conseguiu decodificar a própria gravação (o app guarda o original). */
export async function paraMp3(gravado: Blob): Promise<Mp3 | null> {
  const C = Ctx();
  if (!C) return null;
  const ctx = new C();
  let buf: AudioBuffer;
  try {
    buf = await ctx.decodeAudioData(await gravado.arrayBuffer());
  } catch {
    return null;
  } finally {
    ctx.close().catch(() => {});
  }

  // mono: média dos canais
  const n = buf.length;
  const mono = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += d[i] / buf.numberOfChannels;
  }
  let pico = 0;
  for (let i = 0; i < n; i++) pico = Math.max(pico, Math.abs(mono[i]));
  const temSom = pico > 0.01;
  // gravação baixa (salão barulhento, celular longe): sobe até o pico chegar a 0,9, no máximo 4x
  const ganho = temSom ? Math.min(4, 0.9 / pico) : 1;

  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const enc = new Mp3Encoder(1, buf.sampleRate, 96);
  const partes: Uint8Array[] = [];
  const BLOCO = 1152;
  const pcm = new Int16Array(BLOCO);
  for (let i = 0; i < n; i += BLOCO) {
    const fim = Math.min(n, i + BLOCO);
    for (let k = i; k < fim; k++) {
      const s = Math.max(-1, Math.min(1, mono[k] * ganho));
      pcm[k - i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const saida = enc.encodeBuffer(fim - i === BLOCO ? pcm : pcm.subarray(0, fim - i));
    if (saida.length) partes.push(new Uint8Array(saida));
  }
  const resto = enc.flush();
  if (resto.length) partes.push(new Uint8Array(resto));
  return { blob: new Blob(partes as BlobPart[], { type: 'audio/mpeg' }), temSom, segundos: buf.duration };
}
