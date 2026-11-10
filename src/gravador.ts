// Gravação da resposta da noiva pelo microfone do aparelho.
// iPhone e iPad gravam em .m4a (audio/mp4); Android e computador costumam gravar em .webm.
//
// Cuidados que evitam gravação muda:
// - o medidor de nível (LEDs) escuta uma CÓPIA da faixa do microfone, nunca a mesma que vai para o gravador;
// - o AudioContext do medidor nasce dentro do toque em "Gravar" (no iPhone, fora do toque ele fica suspenso);
// - o gravador junta tudo só no fim (sem pedaços a cada segundo, que no Safari geram .m4a fragmentado);
// - depois de parar, o app converte para MP3 e confere se a gravação tem som antes de guardar (src/mp3.ts).

// webm primeiro: no Chrome, "audio/mp4" sai com Opus dentro (quase nenhum player toca). O iPhone só grava mp4 (AAC).
// De qualquer jeito, o app converte para MP3 ao parar (src/mp3.ts).
const PREFERIDOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export interface Gravacao {
  inicio: number;
  /** de 0 a 1: quão alto está chegando ao microfone agora */
  nivel(): number;
  /** o microfone foi cortado pelo aparelho (outra app, ligação, bloqueio) */
  cortado(): boolean;
  parar(): Promise<{ blob: Blob; mime: string }>;
  cancelar(): void;
}

export const podeGravar = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

type CtxCtor = typeof AudioContext;
const Ctx = (): CtxCtor | undefined => window.AudioContext ?? (window as unknown as { webkitAudioContext?: CtxCtor }).webkitAudioContext;

export async function gravar(): Promise<Gravacao> {
  // criado ainda dentro do toque, antes de qualquer await
  let ctx: AudioContext | null = null;
  try {
    const C = Ctx();
    ctx = C ? new C() : null;
    ctx?.resume().catch(() => {});
  } catch {
    ctx = null;
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    ctx?.close().catch(() => {});
    throw e;
  }
  const faixa = stream.getAudioTracks()[0];
  const tipo = PREFERIDOS.find((t) => MediaRecorder.isTypeSupported?.(t));
  const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
  const pedacos: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && pedacos.push(e.data);

  // medidor de nível numa cópia da faixa
  let copia: MediaStream | null = null;
  let analisador: AnalyserNode | null = null;
  try {
    if (ctx) {
      copia = stream.clone();
      analisador = ctx.createAnalyser();
      analisador.fftSize = 512;
      ctx.createMediaStreamSource(copia).connect(analisador);
    }
  } catch {
    analisador = null;
  }
  const dados = new Uint8Array(512);

  const desligar = () => {
    stream.getTracks().forEach((t) => t.stop());
    copia?.getTracks().forEach((t) => t.stop());
    ctx?.close().catch(() => {});
  };

  rec.start();
  return {
    inicio: Date.now(),
    nivel() {
      if (!analisador) return 0;
      analisador.getByteTimeDomainData(dados);
      let pico = 0;
      for (const d of dados) pico = Math.max(pico, Math.abs(d - 128));
      return Math.min(1, pico / 90);
    },
    cortado: () => !faixa || faixa.readyState === 'ended' || faixa.muted,
    parar() {
      return new Promise((ok, falha) => {
        rec.onstop = () => {
          desligar();
          const mime = (rec.mimeType || tipo || 'audio/webm').split(';')[0];
          const blob = new Blob(pedacos, { type: mime });
          blob.size ? ok({ blob, mime }) : falha(new Error('A gravação veio vazia'));
        };
        if (rec.state === 'inactive') rec.onstop!(new Event('stop'));
        else {
          rec.requestData?.();
          rec.stop();
        }
      });
    },
    cancelar() {
      rec.onstop = null;
      if (rec.state !== 'inactive') rec.stop();
      desligar();
    },
  };
}
