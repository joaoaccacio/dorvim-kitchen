# Validação executada

Data: 15 de outubro de 2026, ambiente Linux com Node.js 24 e Chromium.

| Verificação | Resultado |
| --- | --- |
| Instalação reproduzível com `npm ci` | Passou usando o lockfile |
| `npm run build` | TypeScript e distribuição estática passaram; cache offline gerado |
| `npm test` | 40 testes passaram: 27 de simulação e 13 de persistência |
| `npm run test:browser` | Nove fluxos completos passaram, sem erros de console ou página |
| Telas | Nove telas verificadas em 1440×1000 e 1024×768, sem transbordamento horizontal |
| `npm run test:offline` | Rede desativada, página recarregada, carreira restaurada e cozinha acessível; JS e CSS vieram do service worker |

O teste de navegador executou os oito tipos de preparo, retomou uma receita salva pela metade, serviu pratos, verificou recompensas, compras, ajustes de preços, configurações, equipe, automação, salários, tributos, inspeção, expansão e as três rodadas da competição. As simulações chegaram aos cinco capítulos nas três dificuldades, sem apoio emergencial e sem dívida.

Foram comparados 180 pontos de salvamento e recarga com a simulação contínua, incluindo trabalhos manuais e automáticos em duas unidades. Também há casos de corrupção, recuperação por backup, versões incompatíveis, limite de armazenamento e prevenção de recompensa duplicada.

Uma medição do renderizador, com quatro unidades, 28 funcionários e 32 comandas, registrou mediana de 2,6 ms e percentil 95 de 5,0 ms por callback do cenário durante dez segundos. A simulação desse cenário usou velocidade 0,25× para conservar a carga visual. Vinte ciclos de navegação mantiveram somente os loops e canvases esperados, sem acúmulo. Os números descrevem esta máquina e não garantem 60 FPS em outros equipamentos.

Firefox e Safari não foram executados. Não houve teste de usabilidade com jogadores externos nem uma sessão humana de várias horas. Os limites dos modelos de estoque, equipe e especialização estão em [DESIGN.md](DESIGN.md).
