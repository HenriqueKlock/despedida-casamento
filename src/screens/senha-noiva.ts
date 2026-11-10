import { APP_URL, NOIVA, NOIVO } from '../config';
import { criarSenha, estado } from '../estado';
import { ErroDeRede } from '../ponte';
import { icone } from '../svg';
import { esc } from '../ui';

// Depois da fita 2, a noiva cria uma senha. Com ela, o noivo abre a página /noivo (na despedida dele)
// e ouve as respostas dela, faixa por faixa.

const OUVIDA = 'despedida.fita2Ouvida';
export const fita2Ouvida = () => {
  try {
    return localStorage.getItem(OUVIDA) === '1';
  } catch {
    return false;
  }
};
export const marcarFita2Ouvida = () => {
  try {
    localStorage.setItem(OUVIDA, '1');
  } catch {
    /* sem armazenamento: a senha aparece de novo quando a fita 2 terminar */
  }
};

/** Zerar o placar recomeça a brincadeira: a senha volta a aparecer só quando a fita 2 terminar de novo. */
export const esquecerFita2Ouvida = () => {
  try {
    localStorage.removeItem(OUVIDA);
  } catch {
    /* nada a esquecer */
  }
};

const endereco = () => APP_URL.replace(/^https?:\/\//, '') + 'noivo';

function pronto(): string {
  const fila = estado.naFila
    ? `<p class="nota clara">Ainda ${estado.naFila === 1 ? 'tem 1 resposta subindo' : `tem ${estado.naFila} respostas subindo`} pro Drive. Deixe o app aberto com internet até essa mensagem sumir.</p>`
    : '';
  return `<div class="senha-pronta" role="status">
      <p class="pergunta-match">${icone.cadeado} Fita lacrada!</p>
      <p class="texto claro">Passe a senha pro ${esc(NOIVO)}. Ele ouve o seu lado B em <strong>${esc(endereco())}</strong></p>
      ${fila}
      <button type="button" class="link claro" data-acao="trocar-senha">Trocar a senha</button>
    </div>`;
}

function formulario(): string {
  return `<form class="form-senha" data-form="senha" novalidate>
      <p class="pergunta-match">Agora é a sua vez, ${esc(NOIVA)}</p>
      <p class="texto claro">Crie uma senha. Com ela, o ${esc(NOIVO)} ouve as suas respostas lá na despedida dele.</p>
      <label class="rotulo-senha" for="senha-noiva">SENHA PRO ${esc(NOIVO.toUpperCase())}</label>
      <input id="senha-noiva" name="senha" type="text" inputmode="text" autocomplete="off" autocapitalize="none" spellcheck="false" minlength="4" maxlength="60" required>
      <p class="nota clara erro" id="senha-erro" hidden></p>
      <button type="submit" class="botao principal">${icone.cadeado}LACRAR E MANDAR</button>
    </form>`;
}

let trocando = false;
export function painelSenha(): string {
  return estado.senhaCriada && !trocando ? pronto() : formulario();
}

/**
 * Redesenha a caixa quando o estado mudou (ex.: o Drive avisou que a senha já existe),
 * mas nunca no meio da digitação.
 */
export function atualizarSenha(caixa: HTMLElement) {
  const campo = caixa.querySelector<HTMLInputElement>('#senha-noiva');
  if (campo && (campo.value || document.activeElement === campo)) return;
  const novo = painelSenha();
  if (caixa.dataset.html !== novo) {
    caixa.innerHTML = novo;
    caixa.dataset.html = novo;
  }
}

/** Liga o formulário dentro do contêiner (a tela redesenha o contêiner quando o estado muda). */
export function ligarSenha(caixa: HTMLElement) {
  caixa.addEventListener('click', (ev) => {
    if ((ev.target as HTMLElement).closest('[data-acao="trocar-senha"]')) {
      trocando = true;
      caixa.innerHTML = painelSenha();
      caixa.querySelector<HTMLInputElement>('#senha-noiva')?.focus();
    }
  });
  caixa.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.target as HTMLFormElement;
    const campo = form.querySelector<HTMLInputElement>('#senha-noiva')!;
    const erro = form.querySelector<HTMLElement>('#senha-erro')!;
    const botao = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const senha = campo.value.trim();
    if (senha.length < 4) {
      erro.hidden = false;
      erro.textContent = 'A senha precisa ter pelo menos 4 letras ou números.';
      return campo.focus();
    }
    botao.disabled = true;
    erro.hidden = true;
    try {
      await criarSenha(senha);
      trocando = false;
      caixa.innerHTML = painelSenha();
    } catch (e) {
      erro.hidden = false;
      erro.textContent = e instanceof ErroDeRede ? 'Sem internet agora. A senha precisa de internet pra ser lacrada: tente de novo.' : e instanceof Error ? e.message : String(e);
      botao.disabled = false;
    }
  });
}
