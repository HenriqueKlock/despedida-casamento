// Gravação da resposta da noiva pelo microfone do aparelho.
// iPhone e iPad gravam em .m4a (audio/mp4); Android e computador costumam gravar em .webm.

const PREFERIDOS = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

export interface Gravacao {
  inicio: number;
  /** de 0 a 1: quão alto está chegando ao microfone agora */
  nivel(): number;
  parar(): Promise<{ blob: Blob; mime: string }>;
  cancelar(): void;
}

export const podeGravar = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export async function gravar(): Promise<Gravacao> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const tipo = PREFERIDOS.find((t) => MediaRecorder.isTypeSupported?.(t));
  const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo, audioBitsPerSecond: 64_000 } : undefined);
  const pedacos: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && pedacos.push(e.data);

  // medidor de nível (os "LEDs" do gravador)
  let ctx: AudioContext | null = null;
  let analisador: AnalyserNode | null = null;
  try {
    ctx = new AudioContext();
    analisador = ctx.createAnalyser();
    analisador.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analisador);
  } catch {
    /* sem medidor, grava igual */
  }
  const dados = new Uint8Array(512);

  const desligar = () => {
    stream.getTracks().forEach((t) => t.stop());
    ctx?.close().catch(() => {});
  };

  rec.start(1000);
  return {
    inicio: Date.now(),
    nivel() {
      if (!analisador) return 0;
      analisador.getByteTimeDomainData(dados);
      let pico = 0;
      for (const d of dados) pico = Math.max(pico, Math.abs(d - 128));
      return Math.min(1, pico / 90);
    },
    parar() {
      return new Promise((ok, falha) => {
        rec.onstop = () => {
          desligar();
          const mime = (rec.mimeType || tipo || 'audio/webm').split(';')[0];
          const blob = new Blob(pedacos, { type: mime });
          blob.size ? ok({ blob, mime }) : falha(new Error('A gravação veio vazia'));
        };
        rec.state === 'inactive' ? rec.onstop!(new Event('stop')) : rec.stop();
      });
    },
    cancelar() {
      rec.onstop = null;
      if (rec.state !== 'inactive') rec.stop();
      desligar();
    },
  };
}
