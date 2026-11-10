# Fita da despedida

Brincadeira da despedida da Fernanda. As madrinhas fizeram perguntas ao Henrique, e ele respondeu em áudio pelo WhatsApp. Na festa, o app mostra uma pergunta por vez. A Fernanda responde em voz alta, a resposta dela é gravada e só depois a fita com a resposta do noivo destrava e toca. A madrinha marca se **deu match** ou **não deu match**, e no fim aparece o placar.

- App: https://henriqueklock.github.io/despedida-casamento/ (as madrinhas entram só pelo link com a chave, `#k=…`).
- Telas: canvas "Fita da Despedida" (mockup aprovado).
- Segue os padrões do [Casamento Babys](https://github.com/HenriqueKlock/casamento-babys) e do [Enche AI](https://github.com/HenriqueKlock/encheai).

## Como funciona

- **App (PWA):** Vite + TypeScript, sem framework, publicado no GitHub Pages. Telas em `src/screens/`, rotas por endereço (`#/`, `#/faixas`, `#/faixa/4`, `#/tocar/4`, `#/fim`). Responsivo: celular, tablet e TV. Em tela larga e deitada, a pergunta e a fita ficam lado a lado.
  - Regras sem tela, testadas: `src/regras.ts` (lista de perguntas, ligação pergunta ↔ áudio, nomes, placar).
  - **Tudo fica no aparelho** (IndexedDB, `src/store.ts`): ao abrir o link, o app baixa a lista e todos os áudios do noivo. A partir daí a fita toca mesmo sem Wi-Fi.
  - **Gravação** (`src/gravador.ts`): microfone do navegador. iPhone/iPad gravam `.m4a`, Android e computador gravam `.webm`.
  - **Fila para o Drive** (`src/estado.ts`): respostas e placar ficam guardados no aparelho até a ponte confirmar. Sobem sozinhos ao voltar a internet, ao reabrir o app e a cada 20 s. O id de cada envio é gerado no aparelho, então reenviar não duplica.
  - **Áudios do WhatsApp (.ogg)** (`src/fita.ts`): quando o aparelho não sabe tocar `.ogg` (alguns iPhones), o app decodifica e toca como `.wav`. A decodificação acontece enquanto a noiva responde.
  - A tela fica acesa durante a brincadeira (quando o aparelho deixa).
- **Ponte do Drive** (`apps-script/Ponte.gs`): app da Web do Google Apps Script que roda como o Henrique. Não há banco de dados nem login.
  - `lista`: lê a lista de perguntas (Google Docs, planilha na coluna A, ou `.txt`; dá preferência ao arquivo com "pergunta" no nome) e lista os áudios da pasta.
  - `audio`: entrega um áudio em base64. Só entrega arquivos de dentro da pasta.
  - `resposta`: salva a gravação da noiva em **Respostas da Fernanda** (subpasta), com nome do tipo `04 - O que ele mais admira na Fernanda.m4a`. Regravar gera um arquivo novo (`(2)`), e o primeiro continua lá.
  - `placar`: acrescenta uma linha na planilha **Placar da despedida**, na mesma pasta.
  - Nada responde sem a **chave**, guardada nas Propriedades do script. Ela vai só no link das madrinhas, nunca no repositório. O app tira a chave do endereço assim que abre.
- **Ligação pergunta ↔ áudio:** o número no nome do arquivo manda (`pergunta-7.ogg`, `01.ogg`, `3 - viagem.ogg`).
  - Resposta em mais de um áudio: `pergunta-10.ogg` e depois `pergunta-10-1.ogg` (ou `(2)`, `parte 2`) viram uma fita só, com uma pausa curta entre as partes.
  - Áudio sem número (ex.: `extra.ogg`) vira a **faixa bônus**, que aparece no fim, sem placar.
  - Nenhum áudio com número (nomes do WhatsApp): vale a ordem dos nomes, que é a ordem da gravação.
  - A tela de faixas tem uma "Conferência da fita" que avisa se faltar ou sobrar áudio.
- **Surpresa:** perguntas e áudios nunca entram no repositório nem no build (o `.gitignore` bloqueia áudio). Quem abre o endereço sem a chave vê só "Abra pelo link que as madrinhas receberam".

## Configuração (uma vez, pelo Henrique)

1. **Apps Script:** script.google.com › Novo projeto › colar `apps-script/Ponte.gs`.
2. Executar `conferirPasta` e autorizar (Avançado › Acessar). Conferir no registro a lista e os áudios encontrados.
3. Executar `gerarChave`. O registro mostra o **link das madrinhas**. Rodar de novo troca a chave, e o link antigo para de funcionar.
4. Implantar › Nova implantação › App da Web › Executar como: **Eu** › Quem pode acessar: **Qualquer pessoa**. Copiar a URL `/exec` para `PONTE_URL` em `src/config.ts`. A URL é pública, mas sem a chave a ponte não responde.
5. Mudou o código da ponte? Implantar › Gerenciar implantações › editar › Nova versão (a URL continua a mesma).
6. **GitHub › Settings › Pages:** Source = GitHub Actions.

## Desenvolvimento

```
npm ci
npm run dev:mock   # http://localhost:5173/despedida-casamento/#k=<64 letras/números>  (ponte de teste, perguntas de exemplo)
npm test           # regras
npm run check      # tipos
```

- Para testar o caminho do iPhone (decodificar `.ogg`): no console, `localStorage.setItem('despedida.decodificar', '1')`.
- `tests/blackbox.mjs` roda a cada deploy: o build não pode ter áudio, chave nem a ponte de teste, e a ponte não pode responder sem a chave certa.

## No dia

1. Abrir o link das madrinhas com internet, antes da festa, e esperar "Rebobinando a fita… N de N" terminar. A partir daí funciona offline.
2. Deixar o aparelho na tomada. Se for usar a TV, espelhe a tela do celular ou abra o link num notebook ligado no HDMI.
3. No fim, a linha "Respostas no Drive" mostra quantas já subiram. Se houver fila, é só deixar o app aberto com internet.

## Depois

As respostas ficam em **Respostas da Fernanda**, e o placar na planilha. Para desligar a ponte: Implantar › Gerenciar implantações › Arquivar.
