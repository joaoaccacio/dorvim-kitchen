# Dorvim Kitchen

Simulador de carreira gastronômica para navegador, em português. Comece com uma cozinha pequena, prepare pratos com gestos, organize o serviço e desenvolva um negócio com equipe, competições e novas unidades.

O jogo usa TypeScript, Canvas 2D, SVG e Web Audio. A execução acontece no navegador; não há conta, backend, pagamentos ou serviços externos. Arte e áudio são gerados pelo código.

## Executar

Para desenvolver, use Node.js 24 e npm. Quem joga uma versão hospedada precisa apenas abrir o endereço no navegador, sem instalar ferramentas. Na pasta do projeto:

```bash
npm ci
npm run dev
```

Abra o endereço indicado pelo Vite, normalmente `http://localhost:5173`. A instalação precisa acessar o registro npm. No desenvolvimento, mantenha o servidor local aberto; o cache para reabrir sem conexão pertence à versão de produção.

Em tarefas Codex, utilize o checkout existente: cada tarefa já tem um ambiente isolado e não precisa de um Git worktree adicional.

## Jogar

1. Crie uma carreira em Casual, Normal ou Especialista. O modo Casual oferece mais tolerância para aprender.
2. Confira o cardápio e a despensa, depois abra o serviço.
3. Escolha uma comanda e execute suas etapas. Sirva o prato pronto antes que o cliente perca a paciência.
4. Acompanhe o fechamento, reponha ingredientes e cuide da higiene, manutenção e contas antes do próximo dia.
5. Ganhe experiência para contratar, disputar competições e, no último capítulo, abrir outras unidades.

No restaurante, use **WASD ou setas** para andar, **E** para interagir com a estação próxima ou clique diretamente nas estações. **1** abre uma comanda disponível. **Espaço** pausa o serviço; o botão de velocidade alterna entre 1× e 2×. **Ctrl/Cmd + S** salva. **Esc** fecha a janela aberta. Atalhos não substituem a edição dos campos de formulário.

| Preparo | Mouse ou toque | Teclado |
| --- | --- | --- |
| Cortar | Deslize de cima para baixo sobre as marcas | Setas escolhem a marca; Espaço corta |
| Misturar | Faça círculos no sentido horário | Segure a seta direita; esquerda inverte |
| Grelhar | Ajuste o fogo, vire na metade e retire no ponto | Setas ajustam; Espaço vira e depois retira |
| Assar | Ajuste a temperatura e retire na faixa verde | Setas ajustam; Espaço retira |
| Temperar | Segure para dosar e finalize na medida indicada | Segure Espaço; Enter finaliza |
| Empratar | Arraste os preparos para suas silhuetas | Setas escolhem; Espaço posiciona |
| Preparar bebida | Escolha a base, sirva 30 ml por camada e confirme | 1–3 escolhem; segure Espaço; Enter confirma |
| Limpar | Esfregue as manchas com a esponja | Setas escolhem; segure Espaço |

O tempo do serviço continua durante o preparo manual. Configurações, decisões de eventos e competições interrompem o relógio da carreira. Ao ocultar a aba, a simulação para; voltar depois não concede renda nem avança dias automaticamente. Música e efeitos começam após interação e têm volumes independentes. Há opção para reduzir movimentos decorativos.

## Progresso e cópias

A carreira é salva em `localStorage`, automaticamente durante o jogo e após ações, além do botão de salvar. Uma cópia local anterior válida permite recuperação se o arquivo principal ficar corrompido. Configurações são armazenadas separadamente.

Em **Configurações → Exportar cópia**, baixe um arquivo JSON. Use **Carregar carreira → Importar arquivo** no menu inicial para restaurá-lo. A importação valida a estrutura e a integridade antes de substituir a carreira atual. Arquivos de versões futuras são recusados; há migração do formato anterior suportado.

O armazenamento pertence à origem do navegador: mudar endereço, porta ou perfil pode mostrar outra carreira. Limpar dados, navegação privada e limites de espaço podem impedir a persistência. A cópia automática fica no mesmo navegador; exporte arquivos para guardar progresso fora dele. Criar ou importar uma carreira substitui o progresso local. A verificação de integridade detecta corrupção acidental e não é um sistema de autenticação ou proteção contra edição deliberada.

## Verificar

```bash
npm test
npm run build
```

Os testes cobrem simulação, economia, qualidade, automação, expansão, fiscalização, eventos, competições e persistência. Cenários com comandos, ticks e semente controlados comparam a carreira contínua com a carreira exportada e restaurada.

Para a verificação real no Chromium, mantenha `npm run dev` aberto em outro terminal. Os scripts usam `CHROMIUM_PATH` quando definido, o Chromium de `/usr/bin/chromium` quando disponível, ou o navegador instalado pelo Playwright. Fora do ambiente cloud:

```bash
npx playwright install chromium
npm run test:browser
```

O script usa `http://127.0.0.1:5173` por padrão. Para outro endereço, defina `BASE_URL` ao executá-lo.

Para validar a distribuição e o recarregamento offline:

```bash
npm run build
npm run test:offline
```

Sem `BASE_URL`, esse teste inicia e encerra seu próprio preview em `http://127.0.0.1:4173`. Com `BASE_URL`, usa a versão de produção já servida nesse endereço. O caminho do Chromium segue a mesma regra acima. O teste aguarda o service worker, desativa a rede, recarrega, restaura a carreira e abre o preparo de uma comanda; também verifica ausência de requisições HTTP externas.

## Distribuir e jogar sem internet

### Cloudflare Workers

O arquivo `wrangler.jsonc` define o nome público `dorvimkitchen`, ativa o endereço `workers.dev` e publica a pasta `dist` como arquivos estáticos. O Wrangler executa `npm run build` antes da publicação. Não há um script Worker de aplicação nem uma página de exemplo para substituir o jogo.

No projeto conectado ao GitHub, use a branch `main`, a raiz do repositório e o comando de deploy `npm run deploy`. O campo de build pode ficar vazio, pois o Wrangler já faz essa etapa. Para previews, use `npm run deploy:preview`.

Depois de enviar alterações à `main`, acompanhe o build em **Deployments** e confirme que o commit mais recente ficou ativo em **Production**. Se a página exibir “Hello world”, a versão ativa ainda não está servindo os arquivos do jogo: confira o commit e o resultado do deploy antes de alterar o código no editor online.

Para validar o pacote de publicação localmente, sem publicar nem fornecer credenciais:

```bash
WRANGLER_SEND_METRICS=false npm run deploy -- --dry-run
```

### Distribuição estática

```bash
npm run build
npm run preview
```

`dist/` contém a distribuição estática, incluindo `sw.js` gerado no build. Publique a pasta em um host estático HTTPS ou use o preview em localhost; não é necessário um servidor de aplicação. O conteúdo compilado não consulta APIs, fontes, imagens ou áudio remotos.

Na versão de produção, o primeiro carregamento completo instala um service worker e armazena os arquivos locais da mesma origem. Depois de sua ativação, é possível abrir ou recarregar o mesmo endereço sem conexão e continuar a carreira salva. Não há instalação obrigatória como aplicativo. O registro exige navegador compatível e contexto seguro, como HTTPS ou localhost; o modo de desenvolvimento não registra o worker. Abrir `index.html` diretamente por `file://` não é o modo suportado.

Mantenha o mesmo endereço e perfil do navegador para reencontrar cache e carreira. Limpar os dados do site remove ambos; restrições de armazenamento podem impedir o cache. Exporte a carreira para guardar uma cópia fora do navegador.

Veja [o design](docs/DESIGN.md) para sistemas e limites atuais, e [a arquitetura](docs/ARCHITECTURE.md) para organização técnica e próximos passos.
