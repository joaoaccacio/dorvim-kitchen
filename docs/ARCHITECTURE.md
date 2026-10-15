# Arquitetura

## Escolhas

O projeto é uma aplicação estática de navegador com TypeScript e Vite. Canvas 2D desenha a cozinha e os preparos; HTML/CSS apresenta gestão e navegação; SVG gera ícones e pratos; Web Audio sintetiza música e efeitos. Essa divisão mantém os arquivos locais e permite construir uma experiência completa sem servidor de aplicação, banco de dados ou dependências de execução remotas.

## Organização

| Arquivo | Responsabilidade |
| --- | --- |
| `src/game/types.ts` | Estado serializável, entidades e união de comandos |
| `src/game/content.ts` | Receitas, ingredientes, candidatos, equipamentos, carreira e eventos |
| `src/game/engine.ts` | Regras, validação de comandos, economia e passagem do tempo |
| `src/main.ts` | Ciclo da aplicação, telas, entrada, integração e salvamento automático |
| `src/render/restaurant.ts` | Cena isométrica, personagens, estações e interação espacial |
| `src/render/cooking.ts` | Oito tipos de preparo e suas alternativas de teclado |
| `src/ui.ts` e `src/style.css` | Componentes visuais, ilustrações vetoriais e apresentação |
| `src/platform/save.ts` | Validação, migração, cópia de recuperação e importação/exportação |
| `src/platform/audio.ts` | Síntese musical, efeitos, volumes e suspensão de áudio |
| `src/platform/offline.ts` | Registro do service worker em produção e contexto seguro |
| `scripts/build-sw.mjs` | Geração do worker e lista dos arquivos locais de `dist/` |
| `tests/` | Testes das regras, persistência e fluxo no navegador |

## Fluxo de dados

Uma interação de interface produz um `Command`. `GameEngine.execute()` confere fase, recursos e referências, altera `GameState` e retorna um resultado para a interface. O estado contém restaurantes, equipe, estoque, pedidos, finanças, progressão e o gerador de números pseudoaleatórios.

Os minijogos transformam gestos em notas por etapa. O motor reserva ingredientes ao iniciar a preparação, registra as notas e calcula a qualidade final; a entrega conclui a transação uma única vez. A renderização lê esse resultado e não cria dinheiro ou estoque por conta própria. A automação passa pelas mesmas restrições de ingredientes e equipamentos.

`requestAnimationFrame` coordena apresentação e avanço. O motor limita os subpassos da simulação a até 0,5 segundo; a interface também limita saltos entre quadros. A semente pertence à carreira, permitindo reproduzir resultados com a mesma sequência de comandos e ticks. O horário do computador não gera progresso ausente. A aba oculta suspende a passagem do tempo.

Instâncias de cena e de preparo oferecem destruição explícita para remover eventos, observadores e animações ao trocar de tela. Áudio é liberado por interação do usuário e suspenso em segundo plano.

## Persistência

O formato atual é um envelope JSON versionado com payload e checksum. A leitura valida entidades aninhadas, enums, números finitos e referências de receitas antes de entregar o estado ao motor. O formato anterior suportado recebe valores padrão apenas para os sistemas introduzidos posteriormente; a migração preserva caixa, propriedade e andamento.

Antes de sobrescrever a carreira, um salvamento principal válido é copiado para o backup. Se a leitura principal falhar, tenta-se a cópia. Erros de quota ou bloqueio do navegador são comunicados. A exportação usa o mesmo formato validado; a importação rejeitada não substitui o progresso existente. Checksum não é assinatura criptográfica nem fronteira de segurança.

## Funcionamento offline

Após compilar os arquivos, `scripts/build-sw.mjs` gera `dist/sw.js` com uma lista completa e um identificador derivado do conteúdo. O worker só conclui a instalação quando todos os arquivos necessários foram armazenados. Sua ativação remove caches anteriores do jogo e passa a controlar as páginas abertas.

`registerOffline()` registra o worker após o carregamento, somente em produção, com suporte a service workers e contexto seguro, como HTTPS ou localhost. Navegações tentam a rede e recorrem ao índice em cache quando necessário; os arquivos locais do build são atendidos pelo cache. Apenas requisições GET da mesma origem entram nesse fluxo. O desenvolvimento permanece sem esse cache.

Depois do primeiro carregamento completo e da ativação, o navegador pode reabrir a mesma origem offline. Cache da aplicação e carreira em `localStorage` são mecanismos separados: o primeiro permite abrir o jogo; o segundo restaura o progresso. Limpar os dados do site remove ambos. O usuário não precisa instalar ferramentas nem um aplicativo para jogar em uma hospedagem estática.

## Validação e evolução

Vitest verifica operações isoladas e trajetórias completas. Testes de restauração repetem comandos e ticks em duas carreiras para encontrar divergências de pedidos, saldo, filiais, torneios e efeitos ativos. Playwright verifica a integração real com DOM e Canvas. `npm run build` verifica os tipos, compila `dist/` e gera o worker. `npm run test:offline` testa essa distribuição em produção: ativa o worker, corta a rede, recarrega e verifica carreira e interface jogável, sem importar módulos de desenvolvimento. Sem `BASE_URL`, o teste gerencia seu preview na porta 4173.

A ordem recomendada para ampliar o projeto é: manter invariantes de estado e testes; expandir os dados; implementar novas regras no motor; conectar interfaces; enriquecer arte e som; medir desempenho nos dispositivos alvo. Não há benchmark que sustente uma garantia de 60 FPS. Sistemas mais sofisticados, como lotes independentes, rotas de equipe e agenda de filiais, devem entrar no modelo antes de ganhar telas.

Para desenvolvimento no Codex, continue no checkout isolado existente; não crie Git worktrees adicionais para tarefas comuns.
