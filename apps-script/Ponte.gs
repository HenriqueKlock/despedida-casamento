/**
 * Ponte do Drive · Despedida da Fernanda
 *
 * Roda como você, o dono da pasta. O app publicado no GitHub Pages fala só com esta ponte:
 * - lê a lista de perguntas e os áudios do noivo da pasta;
 * - salva as respostas gravadas da noiva na subpasta "Respostas da Fernanda" e lista o que está lá
 *   (o app considera gravada só a resposta que existe no Drive: apagou lá, a faixa volta a pedir gravação);
 * - anota o placar na planilha "Placar da despedida", dentro da mesma pasta;
 * - guarda a SENHA que a noiva cria no fim da brincadeira, e com ela libera a página do noivo (/noivo):
 *   perguntas, as respostas dela, as dele e o placar.
 *
 * As ações das madrinhas não respondem sem a CHAVE (Propriedades do script). Ela vai só no link das madrinhas, nunca no repositório.
 * As ações do noivo (noivo_lista, noivo_audio) não respondem sem a senha da noiva. A ponte guarda só o hash da senha.
 * A ponte só entrega arquivos que estão dentro da pasta, mesmo para quem tem a chave.
 */

const VERSAO = 4;
const PASTA_ID = '1tmibKHjdz8kiiZCF3KvU2EPSCS01W3je';
const APP_URL = 'https://henriqueklock.github.io/despedida-casamento/';
const PASTA_RESPOSTAS = 'Respostas da Fernanda';
const PLANILHA_PLACAR = 'Placar da despedida';

const EXT_AUDIO = /\.(ogg|opus|oga|m4a|mp3|aac|wav|webm|mp4)$/i;
const MIMES_RESPOSTA = ['audio/mp4', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/x-m4a'];
const MAX_RESPOSTA_BYTES = 25 * 1024 * 1024;

/* ---------- uso no editor (rodar uma vez) ---------- */

/** Cria a chave e mostra no registro o link completo das madrinhas. Rodar de novo troca a chave (o link antigo para de funcionar). */
function gerarChave() {
  const chave = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('CHAVE', chave);
  Logger.log('Link das madrinhas (não mande para a noiva):\n' + APP_URL + '#k=' + chave);
}

/** Apaga a senha da noiva (a página do noivo volta a ficar trancada até ela criar outra). */
function apagarSenha() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('SENHA_SAL');
  props.deleteProperty('SENHA_HASH');
  Logger.log('Senha apagada.');
}

/** Mostra no registro o que a ponte enxerga na pasta, para conferir antes da festa. */
function conferirPasta() {
  const d = lista_();
  Logger.log('Ponte versão ' + VERSAO + ' · pasta: ' + d.pasta);
  Logger.log('Lista de perguntas: ' + (d.lista ? d.lista.nome : 'NÃO ENCONTRADA'));
  if (d.lista) {
    const linhas = d.lista.texto.replace(/\r\n?/g, '\n').split('\n').map(function (l) { return l.trim(); }).filter(String);
    const numeradas = linhas.filter(function (l) { return /^\s*(pergunta\s*)?\d{1,3}\s*([.)\-–—:ºª°]+|\s)/i.test(l); });
    Logger.log(d.lista.texto.length + ' caracteres · ' + linhas.length + ' linha(s) com texto · ' + numeradas.length + ' numerada(s)\n' +
      'Primeiras: \n' + linhas.slice(0, 3).join('\n') + '\n…\nÚltima: ' + linhas[linhas.length - 1]);
  }
  Logger.log(d.audios.length + ' áudio(s):\n' + d.audios.map(function (a) { return '- ' + a.nome + ' (' + a.mime + ', ' + Math.round(a.tamanho / 1024) + ' KB)'; }).join('\n'));
}

/* ---------- app da Web ---------- */

function doGet() {
  return json_({ ok: true, dados: 'ponte da despedida no ar', versao: VERSAO });
}

function doPost(e) {
  return responder_(function () {
    const b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    // página do noivo: só com a senha que a noiva criou
    if (b.acao === 'noivo_lista' || b.acao === 'noivo_audio') {
      conferirSenha_(b.senha);
      if (b.acao === 'noivo_audio') return audio_(b.id);
      const d = lista_();
      d.resultados = resultados_();
      return d;
    }
    conferirChave_(b.chave);
    if (b.acao === 'senha') return definirSenha_(b.senha);
    if (b.acao === 'lista') {
      const d = lista_();
      d.senhaCriada = !!PropertiesService.getScriptProperties().getProperty('SENHA_HASH');
      return d;
    }
    if (b.acao === 'audio') return audio_(b.id);
    if (b.acao === 'resposta') return salvarResposta_(b);
    if (b.acao === 'placar') return salvarPlacar_(b);
    throw new Error('acao_invalida');
  });
}

function responder_(fn) {
  try {
    return json_({ ok: true, dados: fn() });
  } catch (err) {
    return json_({ ok: false, erro: String((err && err.message) || err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function conferirChave_(c) {
  const certa = PropertiesService.getScriptProperties().getProperty('CHAVE');
  if (!certa || certa.length < 32) throw new Error('ponte_sem_chave');
  if (typeof c !== 'string' || c !== certa) {
    Utilities.sleep(1000); // atrasa quem tenta adivinhar
    throw new Error('chave');
  }
}

/* ---------- senha da noiva ---------- */

function normalizarSenha_(s) {
  return String(s || '').trim().toLowerCase();
}

function hashSenha_(sal, senha) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + ':' + senha, Utilities.Charset.UTF_8));
}

/** A noiva cria (ou troca) a senha no fim da brincadeira. Só pelo app das madrinhas (com a chave). */
function definirSenha_(senha) {
  const s = normalizarSenha_(senha);
  if (s.length < 4 || s.length > 60) throw new Error('senha_tamanho');
  const sal = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperties({ SENHA_SAL: sal, SENHA_HASH: hashSenha_(sal, s) });
  return { criada: true };
}

function conferirSenha_(senha) {
  const props = PropertiesService.getScriptProperties();
  const hash = props.getProperty('SENHA_HASH');
  if (!hash) throw new Error('sem_senha');
  if (hashSenha_(props.getProperty('SENHA_SAL'), normalizarSenha_(senha)) !== hash) {
    Utilities.sleep(1500); // atrasa quem tenta adivinhar
    throw new Error('senha');
  }
}

/** Último resultado de cada faixa na planilha do placar: { "4": "match", "5": "sem_match" }. */
function resultados_() {
  const it = DriveApp.getFolderById(PASTA_ID).getFilesByName(PLANILHA_PLACAR);
  let ss = null;
  while (it.hasNext()) {
    const f = it.next();
    if (!f.isTrashed() && f.getMimeType() === MimeType.GOOGLE_SHEETS) ss = SpreadsheetApp.openById(f.getId());
  }
  const res = {};
  if (!ss) return res;
  const linhas = ss.getSheets()[0].getDataRange().getValues().slice(1);
  linhas.forEach(function (l) {
    const faixa = Number(l[1]);
    if (faixa > 0) res[faixa] = l[3] === 'Deu match' ? 'match' : 'sem_match';
  });
  return res;
}

/* ---------- leitura ---------- */

function ehAudio_(f) {
  return /^audio\//.test(f.getMimeType()) || f.getMimeType() === 'application/ogg' || EXT_AUDIO.test(f.getName());
}

function lista_() {
  const pasta = DriveApp.getFolderById(PASTA_ID);
  const arquivos = [];
  const it = pasta.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (!f.isTrashed()) arquivos.push(f);
  }
  const audios = arquivos.filter(ehAudio_).map(function (f) {
    return {
      id: f.getId(),
      nome: f.getName(),
      mime: f.getMimeType(),
      tamanho: f.getSize(),
      criado: f.getDateCreated().toISOString(),
      alterado: f.getLastUpdated().toISOString(),
    };
  });
  return { pasta: pasta.getName(), lista: lerLista_(arquivos.filter(function (f) { return !ehAudio_(f); })), audios: audios, respostas: respostas_(pasta) };
}

/** As gravações da noiva que estão na subpasta (fora da lixeira). */
function respostas_(pasta) {
  const it = pasta.getFoldersByName(PASTA_RESPOSTAS);
  if (!it.hasNext()) return [];
  const sub = it.next();
  const lista = [];
  const fs = sub.getFiles();
  while (fs.hasNext()) {
    const f = fs.next();
    if (f.isTrashed() || !ehAudio_(f)) continue;
    lista.push({ id: f.getId(), nome: f.getName(), mime: f.getMimeType(), tamanho: f.getSize(), criado: f.getDateCreated().toISOString(), alterado: f.getLastUpdated().toISOString() });
  }
  return lista;
}

/** A lista de perguntas: um Google Doc, uma planilha (coluna A) ou um .txt. Dá preferência ao que tem "pergunta" no nome. */
function lerLista_(arquivos) {
  const tipos = [MimeType.GOOGLE_DOCS, MimeType.GOOGLE_SHEETS, MimeType.PLAIN_TEXT, 'text/markdown', 'text/csv'];
  const candidatos = arquivos.filter(function (f) { return tipos.indexOf(f.getMimeType()) >= 0; });
  candidatos.sort(function (a, b) {
    return (/pergunta/i.test(b.getName()) ? 1 : 0) - (/pergunta/i.test(a.getName()) ? 1 : 0);
  });
  const f = candidatos[0];
  if (!f) {
    const outro = arquivos.filter(function (x) { return /pergunta/i.test(x.getName()); })[0];
    if (outro) throw new Error('lista_formato:' + outro.getName()); // ex.: .docx ou PDF; abrir com Google Docs resolve
    return null;
  }
  let texto;
  if (f.getMimeType() === MimeType.GOOGLE_DOCS) {
    texto = DocumentApp.openById(f.getId()).getBody().getText();
  } else if (f.getMimeType() === MimeType.GOOGLE_SHEETS) {
    const valores = SpreadsheetApp.openById(f.getId()).getSheets()[0].getDataRange().getDisplayValues();
    texto = valores.map(function (linha) { return linha[0]; }).join('\n');
  } else {
    texto = textoDoArquivo_(f);
  }
  return { id: f.getId(), nome: f.getName(), alterado: f.getLastUpdated().toISOString(), texto: texto };
}

/** .txt salvo em qualquer codificação: UTF-8 (com ou sem BOM), UTF-16 (Bloco de Notas "Unicode") ou Windows-1252. */
function textoDoArquivo_(f) {
  const bytes = f.getBlob().getBytes();
  const b = function (i) { return i < bytes.length ? bytes[i] & 255 : -1; };
  let cs = 'UTF-8';
  if (b(0) === 0xff && b(1) === 0xfe) cs = 'UTF-16LE';
  else if (b(0) === 0xfe && b(1) === 0xff) cs = 'UTF-16BE';
  else {
    let pares = 0, impares = 0;
    for (let i = 0; i < Math.min(bytes.length, 400); i++) if (bytes[i] === 0) (i % 2 ? impares++ : pares++);
    if (impares > 10) cs = 'UTF-16LE';
    else if (pares > 10) cs = 'UTF-16BE';
  }
  let texto = Utilities.newBlob(bytes).getDataAsString(cs);
  if (cs === 'UTF-8' && texto.indexOf('�') >= 0) texto = Utilities.newBlob(bytes).getDataAsString('windows-1252');
  return texto.replace(/^﻿/, '');
}

/** Um áudio em base64 (do noivo, ou uma gravação da noiva). Só entrega arquivos da pasta ou da subpasta de respostas. */
function audio_(id) {
  if (typeof id !== 'string' || !/^[\w-]{10,100}$/.test(id)) throw new Error('id_invalido');
  const f = DriveApp.getFileById(id);
  if (!dentroDaPasta_(f) || !ehAudio_(f)) throw new Error('fora_da_pasta');
  return { id: id, nome: f.getName(), mime: f.getMimeType(), base64: Utilities.base64Encode(f.getBlob().getBytes()) };
}

function dentroDaPasta_(f) {
  const pais = f.getParents();
  while (pais.hasNext()) {
    const p = pais.next();
    if (p.getId() === PASTA_ID) return true;
    if (p.getName() === PASTA_RESPOSTAS) {
      const avos = p.getParents();
      while (avos.hasNext()) if (avos.next().getId() === PASTA_ID) return true;
    }
  }
  return false;
}

/* ---------- escrita ---------- */

function subpasta_(pai, nome) {
  const it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

function limparNome_(nome) {
  return String(nome || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function conferirId_(id) {
  if (typeof id !== 'string' || !/^[a-z0-9-]{8,64}$/i.test(id)) throw new Error('id_invalido');
}

/**
 * Resposta gravada da noiva. O id vem do celular: se a fila reenviar, a ponte devolve o mesmo arquivo em vez de duplicar.
 * Regravar gera um id novo, e as duas gravações ficam no Drive.
 */
function salvarResposta_(b) {
  conferirId_(b.id);
  const mime = String(b.mime || '').split(';')[0].trim().toLowerCase();
  if (MIMES_RESPOSTA.indexOf(mime) < 0) throw new Error('formato_invalido');
  const nome = limparNome_(b.nome);
  if (!nome) throw new Error('nome_invalido');
  if (typeof b.base64 !== 'string' || b.base64.length > (MAX_RESPOSTA_BYTES * 4) / 3 + 4) throw new Error('arquivo_grande');

  const trava = LockService.getScriptLock();
  trava.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const ja = props.getProperty('r:' + b.id);
    if (ja) return { arquivo: ja, repetido: true };
    const pasta = subpasta_(DriveApp.getFolderById(PASTA_ID), PASTA_RESPOSTAS);
    const blob = Utilities.newBlob(Utilities.base64Decode(b.base64), mime, nome);
    const arq = pasta.createFile(blob);
    props.setProperty('r:' + b.id, arq.getId());
    return { arquivo: arq.getId(), repetido: false };
  } finally {
    trava.releaseLock();
  }
}

/** Uma linha na planilha do placar a cada resultado marcado (também idempotente pelo id). */
function salvarPlacar_(b) {
  conferirId_(b.id);
  const faixa = Number(b.faixa);
  if (!(faixa >= 1 && faixa <= 999)) throw new Error('faixa_invalida');
  if (b.resultado !== 'match' && b.resultado !== 'sem_match') throw new Error('resultado_invalido');

  const trava = LockService.getScriptLock();
  trava.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('p:' + b.id)) return { repetido: true };
    const aba = planilha_().getSheets()[0];
    aba.appendRow([
      new Date(),
      faixa,
      String(b.pergunta || '').slice(0, 500),
      b.resultado === 'match' ? 'Deu match' : 'Não deu match',
      limparNome_(b.resposta),
    ]);
    props.setProperty('p:' + b.id, '1');
    return { repetido: false };
  } finally {
    trava.releaseLock();
  }
}

function planilha_() {
  const pasta = DriveApp.getFolderById(PASTA_ID);
  const it = pasta.getFilesByName(PLANILHA_PLACAR);
  while (it.hasNext()) {
    const f = it.next();
    if (!f.isTrashed() && f.getMimeType() === MimeType.GOOGLE_SHEETS) return SpreadsheetApp.openById(f.getId());
  }
  const ss = SpreadsheetApp.create(PLANILHA_PLACAR);
  DriveApp.getFileById(ss.getId()).moveTo(pasta);
  const aba = ss.getSheets()[0];
  aba.appendRow(['Quando', 'Faixa', 'Pergunta', 'Resultado', 'Resposta da noiva (arquivo)']);
  aba.setFrozenRows(1);
  return ss;
}
