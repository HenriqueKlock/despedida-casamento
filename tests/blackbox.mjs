// Teste de caixa preta, a cada deploy: o que está público (o site e a URL da ponte) não pode entregar a surpresa.
// 1) O build não leva áudio, lista de perguntas nem chave.
// 2) Se a ponte já estiver configurada: sem a chave, ou com chave errada, ela não devolve nada.
// Uso: node tests/blackbox.mjs [pasta-do-build]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const pasta = process.argv[2] ?? 'dist';
const cfg = readFileSync(new URL('../src/config.ts', import.meta.url), 'utf8');
const PONTE = cfg.match(/PONTE_URL = '([^']*)'/)[1];

let falhas = 0;
const ok = (m) => console.log('ok     ' + m);
const ruim = (m) => { falhas++; console.log('FALHOU ' + m); };

// 1) arquivos do build
const todos = [];
const andar = (d) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? andar(join(d, f)) : todos.push(join(d, f))));
andar(pasta);
const audios = todos.filter((f) => /\.(ogg|opus|oga|m4a|mp3|wav|webm|aac)$/i.test(f));
audios.length ? ruim('build com arquivo de áudio: ' + audios.join(', ')) : ok('build sem arquivos de áudio');
const textos = todos.filter((f) => /\.(js|html|css|json|webmanifest)$/.test(f)).map((f) => [f, readFileSync(f, 'utf8')]);
const chave = textos.find(([, t]) => /#k=[a-f0-9]{32,}/i.test(t));
chave ? ruim('build com link de chave: ' + chave[0]) : ok('build sem chave de acesso');
const teste = textos.find(([, t]) => t.includes('Despedida (teste)') || t.includes('OGG_TESTE'));
teste ? ruim('build de produção com a ponte de teste: ' + teste[0]) : ok('build sem a ponte de teste');

// 2) ponte do Drive
async function chamar(corpo) {
  const r = await fetch(PONTE, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo), redirect: 'follow' });
  try { return await r.json(); } catch { return { ok: false, erro: 'http ' + r.status }; }
}
if (!PONTE) {
  console.log('pulei  ponte: PONTE_URL ainda vazio em src/config.ts');
} else {
  for (const acao of ['lista', 'audio', 'resposta', 'placar']) {
    const sem = await chamar({ acao, id: 'x'.repeat(20) });
    !sem.ok && !sem.dados ? ok(`ponte ${acao}: sem chave recusada (${sem.erro})`) : ruim(`ponte ${acao}: respondeu sem chave`);
  }
  const errada = await chamar({ acao: 'lista', chave: 'f'.repeat(64) });
  !errada.ok && !errada.dados ? ok(`ponte lista: chave errada recusada (${errada.erro})`) : ruim('ponte lista: aceitou chave errada');
  const get = await fetch(PONTE, { redirect: 'follow' }).then((r) => r.text()).catch(() => '');
  /pergunta|audio|base64/i.test(get) ? ruim('ponte GET devolve dados') : ok('ponte GET não devolve dados');
}

if (falhas) {
  console.log(`\n${falhas} falha(s)`);
  process.exit(1);
}
console.log('\nTudo fechado.');
