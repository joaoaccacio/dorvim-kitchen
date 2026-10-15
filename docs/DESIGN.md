# Design do jogo

## Intenção

Dorvim Kitchen combina a atenção de cozinhar com as decisões de manter uma casa funcionando. O ciclo é preparar a operação, abrir o serviço, executar e delegar comandas, observar o fechamento e investir no próximo dia. Os clientes têm paciência limitada; aprender a escolher um cardápio viável é parte do jogo.

## Carreira

| Capítulo | Experiência | Foco |
| --- | --- | --- |
| Primeiros sabores | 0 XP | Aprender gestos e atender com recursos iniciais |
| Talento em ascensão | 120 XP | Contratar e organizar uma primeira equipe |
| Cozinha profissional | 380 XP | Receitas elaboradas e competições |
| Chef de referência | 850 XP | Ampliar repertório e melhorar consistência |
| Império gastronômico | 1.500 XP | Expandir e administrar outras unidades |

Receitas e equipamentos têm desbloqueios próprios. A experiência vem do serviço e de atividades da carreira. As conquistas reconhecem atendimento, qualidade, equipe, gestão e vitórias. Os modos Casual, Normal e Especialista alteram tolerância de atendimento e custos; não mudam os controles.

## Sistemas conectados

- **Cozinha:** cortar, misturar, grelhar, assar, temperar, empratar, preparar bebidas e limpar usam gestos diferentes. Precisão e tempo afetam a nota. Frescor, higiene, condição dos equipamentos e capacidade da equipe também entram na qualidade.
- **Cardápio e clientes:** o jogador escolhe receitas disponíveis e ajusta preços. Preço, reputação, variedade e efeitos de eventos influenciam a procura. Demora causa desistências; entregas geram receita, gorjetas, avaliações e experiência.
- **Despensa:** fornecedores variam preço, qualidade e conservação. Ingredientes são consumidos de verdade; lotes vencidos impedem o preparo e são descartados na limpeza. Refrigeração prolonga a validade. Reposição exige dinheiro.
- **Equipe:** auxiliares apoiam preparos; cozinheiros e chefs assumem pedidos; garçons entregam; faxineiros cuidam da higiene; estoquistas repõem com orçamento; gerentes permitem operar filiais. Há contratação, demissão, função, escala, treino, promoção, salário, experiência e fadiga. Cada unidade comporta o número do capítulo mais duas pessoas, até sete no capítulo final. Folga reduz a remuneração do dia, sem eliminá-la.
- **Estrutura:** equipamentos desbloqueiam pratos e alteram capacidade, velocidade, conservação ou higiene. Manutenção recupera a condição. Decoração muda a identidade do salão e a percepção da casa.
- **Finanças:** compras, salários, aluguel, utilidades, manutenção e tributos fictícios entram no livro-caixa. Obrigações não pagas viram pendências. Há um apoio único para recuperar uma carreira com pouco caixa; ele não é uma fonte recorrente de renda.
- **Fiscalização:** limpeza, validade, refrigeração, conservação e higiene da equipe formam um checklist visível. Falhas podem gerar orientação, advertência ou interdição. Corrigir a casa e pedir nova visita permite reabrir.
- **Eventos:** propostas de festival, crítica, abastecimento, oficina, comunidade, manutenção, calor e feira apresentam custos e consequências. São decisões espaçadas entre serviços, com opção de recusa e efeitos registrados na carreira.
- **Competições:** uma inscrição abre três rodadas com exigência crescente, usando os gestos da cozinha e ingredientes fornecidos. O prêmio exige aprovação e é pago uma única vez.
- **Expansão:** no último capítulo, novas casas têm equipamentos, estoque, cardápio, conservação e custos próprios. A rede comporta até quatro unidades. A especialização escolhida influencia a configuração inicial. Uma unidade distante precisa de gerente local ativo para atender.
- **Continuidade:** salvamento local, recuperação automática e arquivos exportados permitem retomar a mesma operação, inclusive pedidos em andamento. Na versão de produção em HTTPS ou localhost, um primeiro carregamento completo com service worker ativado permite abrir e recarregar o mesmo endereço offline. Limpar os dados do site remove cache e carreira. Não há lucro acumulado por tempo fora do jogo.

## Escopo atual e próximos passos

Arte isométrica, pratos, personagens, música e efeitos são procedurais. Oferecem uma identidade própria e operação sem mídia remota; animações e detalhes podem ser ampliados com direção artística e conteúdo adicional.

O estoque mantém um registro agregado por ingrediente em cada restaurante, não lotes independentes com rastreamento FIFO. A combinação de compras usa qualidade ponderada e conserva a validade mais restritiva enquanto há estoque válido. Compras em momentos diferentes podem, portanto, vencer juntas.

Funções de apoio usam cadências e modificadores de simulação; não há logística física detalhada para cada deslocamento. Estações têm interação espacial, mas não há editor livre de planta. As especializações configuram novas unidades; não são árvores completas de habilidades. Competições usam o repertório existente, e eventos seguem uma rotação controlada. As oportunidades de eventos são pontuais; não há um sistema separado de contratos recorrentes.

Tributos e fiscalização são regras fictícias para o jogo. Não representam legislação, cálculo contábil profissional ou procedimentos sanitários reais. A economia foi pensada para permitir recuperação e decisões, não para reproduzir uma empresa real.

Próximos incrementos úteis são lotes separados e descarte seletivo, especializações com desafios próprios, maior variedade visual por receita, equipes com rotas e tarefas mais detalhadas, e testes de usabilidade e desempenho em diferentes dispositivos. Não há medição publicada que garanta 60 FPS ou equivalência visual entre todos os navegadores.
