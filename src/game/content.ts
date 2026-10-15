import type { Candidate, Equipment, GameEvent, Ingredient, Recipe } from './types';

// Quantidades representam porções de cozinha, e preços são dados em reais.
export const INGREDIENTS: Ingredient[] = [
  { id: 'tomate', name: 'Tomate', color: '#e16b52', price: 1.4, shelfLife: 4 },
  { id: 'folhas', name: 'Folhas frescas', color: '#70a16c', price: 1, shelfLife: 3 },
  { id: 'cebola', name: 'Cebola', color: '#d5b6cf', price: 0.8, shelfLife: 8 },
  { id: 'arroz', name: 'Arroz', color: '#eee4ca', price: 1.2, shelfLife: 14 },
  { id: 'feijao', name: 'Feijão', color: '#9a6650', price: 1.4, shelfLife: 14 },
  { id: 'massa', name: 'Massa seca', color: '#e7c66a', price: 2, shelfLife: 14 },
  { id: 'farinha', name: 'Farinha', color: '#e8ddbc', price: 0.9, shelfLife: 14 },
  { id: 'queijo', name: 'Queijo', color: '#e4bd57', price: 2, shelfLife: 6 },
  { id: 'ovo', name: 'Ovos', color: '#d4b08a', price: 1.2, shelfLife: 7 },
  { id: 'frango', name: 'Frango', color: '#dfa894', price: 3.5, shelfLife: 3 },
  { id: 'carne', name: 'Carne bovina', color: '#b9685b', price: 4.8, shelfLife: 3 },
  { id: 'peixe', name: 'Peixe', color: '#91b8b8', price: 4.5, shelfLife: 2 },
  { id: 'leite', name: 'Leite', color: '#eee9da', price: 1, shelfLife: 4 },
  { id: 'fruta', name: 'Frutas da estação', color: '#e6ad5b', price: 1.6, shelfLife: 4 },
];

export const RECIPES: Recipe[] = [
  {
    id: 'salada_horta', name: 'Salada da horta', category: 'Entradas',
    description: 'Folhas crocantes, tomate e cebola. O frescor é o ingrediente principal.',
    color: '#87a970', ingredients: { folhas: 1, tomate: 1, cebola: 1 },
    steps: [
      { action: 'wash', label: 'Lavar as folhas', hint: 'Esfregue a superfície até as folhas ficarem limpas.', target: 12 },
      { action: 'cut', label: 'Cortar os vegetais', hint: 'Faça cortes firmes e regulares sobre a tábua.', target: 7 },
      { action: 'season', label: 'Temperar com equilíbrio', hint: 'Segure para dosar o sal até a marca indicada e confirme para finalizar.', target: 3 },
      { action: 'plate', label: 'Montar a salada', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 16, cost: 3.2, difficulty: 1, unlock: 1, seconds: 20, potential: 90,
  },
  {
    id: 'sanduiche_queijo', name: 'Sanduíche dourado', category: 'Lanches',
    description: 'Pão de chapa com queijo derretido e tomate fresco.',
    color: '#dba660', ingredients: { farinha: 1, queijo: 1, tomate: 1 },
    steps: [
      { action: 'cut', label: 'Fatiar o tomate', hint: 'Deslize pela tábua para fazer fatias do mesmo tamanho.', target: 7 },
      { action: 'grill', label: 'Dourar o sanduíche', hint: 'Vire na primeira faixa verde e retire na faixa verde final.' },
      { action: 'plate', label: 'Servir ainda quente', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 19, cost: 4.3, difficulty: 1, unlock: 1, equipment: 'chapa', seconds: 22, potential: 90,
  },
  {
    id: 'arroz_feijao', name: 'Arroz e feijão da casa', category: 'Brasileiros',
    description: 'Comida de todo dia, feita com cuidado e cebola bem dourada.',
    color: '#ba9065', ingredients: { arroz: 1, feijao: 1, cebola: 1 },
    steps: [
      { action: 'cut', label: 'Picar a cebola', hint: 'Faça movimentos curtos para picar sem esmagar.', target: 7 },
      { action: 'mix', label: 'Refogar e envolver', hint: 'Mova em círculos para misturar os grãos delicadamente.', target: 3 },
      { action: 'season', label: 'Acertar o tempero', hint: 'Segure para dosar o sal até a marca indicada e confirme para finalizar.', target: 3 },
      { action: 'plate', label: 'Montar o prato', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 22, cost: 3.4, difficulty: 1, unlock: 1, seconds: 24, potential: 93,
  },
  {
    id: 'suco_estacao', name: 'Suco da estação', category: 'Bebidas',
    description: 'Fruta madura batida na hora, leve e naturalmente refrescante.',
    color: '#e3b658', ingredients: { fruta: 2 },
    steps: [
      { action: 'wash', label: 'Higienizar as frutas', hint: 'Esfregue toda a área para remover as impurezas.', target: 12 },
      { action: 'cut', label: 'Cortar a polpa', hint: 'Corte a fruta em pedaços pequenos e uniformes.', target: 7 },
      { action: 'drink', label: 'Encher o copo', hint: 'Escolha cada ingrediente, sirva 30 ml e confirme antes de avançar.' },
    ], price: 16, cost: 3.2, difficulty: 1, unlock: 1, seconds: 17, potential: 91,
  },
  {
    id: 'omelete_campo', name: 'Omelete do campo', category: 'Brasileiros',
    description: 'Ovos cremosos, queijo e cebola em uma omelete dobrada na hora.',
    color: '#dfbd61', ingredients: { ovo: 2, queijo: 1, cebola: 1 },
    steps: [
      { action: 'cut', label: 'Preparar o recheio', hint: 'Faça cortes rápidos e mantenha os pedaços pequenos.', target: 7 },
      { action: 'mix', label: 'Bater os ovos', hint: 'Gire em círculos para incorporar ar sem exagerar.', target: 3 },
      { action: 'grill', label: 'Dobrar no ponto', hint: 'Vire na primeira faixa verde e retire na faixa verde final.' },
      { action: 'plate', label: 'Finalizar a omelete', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 24, cost: 5.2, difficulty: 2, unlock: 2, equipment: 'fogao', seconds: 27, potential: 94,
  },
  {
    id: 'frango_grelhado', name: 'Frango do almoço', category: 'Brasileiros',
    description: 'Frango grelhado, arroz soltinho e tomate fresco.',
    color: '#cf9c69', ingredients: { frango: 1, arroz: 1, tomate: 1 },
    steps: [
      { action: 'cut', label: 'Preparar as porções', hint: 'Deslize com precisão para manter a espessura uniforme.', target: 7 },
      { action: 'season', label: 'Temperar o frango', hint: 'Segure para dosar o sal até a marca indicada e confirme para finalizar.', target: 3 },
      { action: 'grill', label: 'Grelhar por igual', hint: 'Vire na primeira faixa verde e retire na faixa verde final.' },
      { action: 'plate', label: 'Organizar o almoço', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 30, cost: 6.1, difficulty: 2, unlock: 2, equipment: 'chapa', seconds: 30, potential: 96,
  },
  {
    id: 'massa_tomate', name: 'Massa ao pomodoro', category: 'Massas',
    description: 'Molho de tomate cozido lentamente, massa e queijo recém-ralado.',
    color: '#cb7455', ingredients: { massa: 1, tomate: 2, cebola: 1, queijo: 1 },
    steps: [
      { action: 'cut', label: 'Picar o tomate', hint: 'Faça cortes regulares para um molho homogêneo.', target: 7 },
      { action: 'mix', label: 'Envolver no molho', hint: 'Desenhe círculos para cobrir a massa por completo.', target: 3 },
      { action: 'season', label: 'Acertar a acidez', hint: 'Segure para dosar o sal até a marca indicada e confirme para finalizar.', target: 3 },
      { action: 'plate', label: 'Montar o ninho', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 29, cost: 7.6, difficulty: 2, unlock: 2, equipment: 'fogao', seconds: 31, potential: 96,
  },
  {
    id: 'bolo_caseiro', name: 'Bolo de fruta caseiro', category: 'Confeitaria',
    description: 'Massa macia com fruta da estação, como nos cafés de família.',
    color: '#c99a68', ingredients: { farinha: 2, ovo: 1, leite: 1, fruta: 1 },
    steps: [
      { action: 'cut', label: 'Picar a fruta', hint: 'Corte cubos pequenos para distribuir pela massa.', target: 7 },
      { action: 'mix', label: 'Preparar a massa', hint: 'Misture em círculos até a textura ficar uniforme.', target: 3 },
      { action: 'bake', label: 'Assar o bolo', hint: 'Ajuste o forno para 190 °C e retire a preparação na faixa verde.' },
      { action: 'plate', label: 'Servir a fatia', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 24, cost: 5.6, difficulty: 2, unlock: 2, equipment: 'forno', seconds: 32, potential: 97,
  },
  {
    id: 'risoto_queijo', name: 'Risoto de queijo', category: 'Autorais',
    description: 'Arroz envolto em um creme de queijo, servido no ponto certo.',
    color: '#dcc98a', ingredients: { arroz: 2, queijo: 1, cebola: 1, leite: 1 },
    steps: [
      { action: 'cut', label: 'Picar a base aromática', hint: 'Faça cortes finos para a cebola desaparecer no creme.', target: 7 },
      { action: 'mix', label: 'Dar cremosidade', hint: 'Mantenha movimentos circulares constantes.', target: 3 },
      { action: 'season', label: 'Equilibrar o queijo', hint: 'Segure para dosar o sal até a marca indicada e confirme para finalizar.', target: 3 },
      { action: 'plate', label: 'Abrir o risoto no prato', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 36, cost: 6.2, difficulty: 3, unlock: 3, equipment: 'fogao', seconds: 36, potential: 99,
  },
  {
    id: 'peixe_dourado', name: 'Peixe dourado da costa', category: 'Brasileiros',
    description: 'Peixe de chapa acompanhado de arroz e uma salada delicada.',
    color: '#d6bd85', ingredients: { peixe: 1, arroz: 1, folhas: 1, tomate: 1 },
    steps: [
      { action: 'wash', label: 'Lavar as folhas', hint: 'Limpe todos os pontos sem deixar áreas esquecidas.', target: 12 },
      { action: 'cut', label: 'Porcionar o peixe', hint: 'Corte porções regulares para uma cocção uniforme.', target: 7 },
      { action: 'season', label: 'Temperar delicadamente', hint: 'Segure para dosar o sal até a marca indicada e confirme para finalizar.', target: 3 },
      { action: 'grill', label: 'Dourar a pele', hint: 'Vire na primeira faixa verde e retire na faixa verde final.' },
      { action: 'plate', label: 'Montar com leveza', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 42, cost: 8.1, difficulty: 3, unlock: 3, equipment: 'chapa', seconds: 39, potential: 100,
  },
  {
    id: 'hamburguer_casa', name: 'Hambúrguer da casa', category: 'Lanches',
    description: 'Carne grelhada, queijo derretido e vegetais no pão da casa.',
    color: '#b98659', ingredients: { carne: 1, farinha: 1, queijo: 1, tomate: 1, folhas: 1 },
    steps: [
      { action: 'wash', label: 'Higienizar a salada', hint: 'Esfregue a área para deixar a salada pronta.', target: 12 },
      { action: 'cut', label: 'Fatiar a guarnição', hint: 'Mantenha a mesma espessura em cada movimento.', target: 7 },
      { action: 'season', label: 'Temperar a carne', hint: 'Segure para dosar o sal até a marca indicada e confirme para finalizar.', target: 3 },
      { action: 'grill', label: 'Selar o hambúrguer', hint: 'Vire na primeira faixa verde e retire na faixa verde final.' },
      { action: 'plate', label: 'Montar as camadas', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 39, cost: 10.1, difficulty: 3, unlock: 3, equipment: 'chapa', seconds: 37, potential: 98,
  },
  {
    id: 'torta_horta', name: 'Torta cremosa da horta', category: 'Confeitaria',
    description: 'Massa dourada, recheio de folhas e queijo, centro cremoso.',
    color: '#b6a36d', ingredients: { farinha: 2, ovo: 1, leite: 1, folhas: 1, queijo: 1 },
    steps: [
      { action: 'wash', label: 'Lavar o recheio', hint: 'Higienize as folhas antes de incorporá-las.', target: 12 },
      { action: 'cut', label: 'Picar as folhas', hint: 'Corte tiras delicadas com movimentos regulares.', target: 7 },
      { action: 'mix', label: 'Preparar o creme', hint: 'Misture em círculos para obter um recheio liso.', target: 3 },
      { action: 'bake', label: 'Dourar a torta', hint: 'Ajuste o forno para 190 °C e retire a preparação na faixa verde.' },
      { action: 'plate', label: 'Servir sem quebrar', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 32, cost: 7, difficulty: 3, unlock: 3, equipment: 'forno', seconds: 38, potential: 99,
  },
  {
    id: 'carne_molho', name: 'Carne ao molho da casa', category: 'Autorais',
    description: 'Carne selada com molho de tomate encorpado e arroz aromático.',
    color: '#af735a', ingredients: { carne: 1, tomate: 2, cebola: 1, arroz: 1 },
    steps: [
      { action: 'cut', label: 'Preparar os cortes', hint: 'Corte em movimentos firmes para preservar a textura.', target: 7 },
      { action: 'season', label: 'Temperar a carne', hint: 'Segure para dosar o sal até a marca indicada e confirme para finalizar.', target: 3 },
      { action: 'grill', label: 'Selar a carne', hint: 'Vire na primeira faixa verde e retire na faixa verde final.' },
      { action: 'mix', label: 'Apurar o molho', hint: 'Misture em círculos até envolver toda a preparação.', target: 3 },
      { action: 'plate', label: 'Desenhar o molho', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 49, cost: 9.6, difficulty: 4, unlock: 4, equipment: 'fogao', seconds: 42, potential: 100,
  },
  {
    id: 'frango_recheado', name: 'Frango recheado do chef', category: 'Autorais',
    description: 'Frango assado com queijo e tomate, acompanhado de folhas.',
    color: '#cc9d70', ingredients: { frango: 2, queijo: 1, tomate: 1, folhas: 1 },
    steps: [
      { action: 'wash', label: 'Lavar a guarnição', hint: 'Limpe a superfície por completo antes da montagem.', target: 12 },
      { action: 'cut', label: 'Abrir as porções', hint: 'Faça cortes precisos para acomodar o recheio.', target: 7 },
      { action: 'season', label: 'Temperar por dentro', hint: 'Segure para dosar o sal até a marca indicada e confirme para finalizar.', target: 3 },
      { action: 'bake', label: 'Assar lentamente', hint: 'Ajuste o forno para 190 °C e retire a preparação na faixa verde.' },
      { action: 'plate', label: 'Revelar o recheio', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 45, cost: 11.4, difficulty: 4, unlock: 4, equipment: 'forno', seconds: 43, potential: 100,
  },
  {
    id: 'massa_artesanal', name: 'Massa fresca recheada', category: 'Massas',
    description: 'Massa feita à mão, recheio de queijo e molho de tomate fresco.',
    color: '#d8ac69', ingredients: { farinha: 2, ovo: 2, queijo: 1, tomate: 1 },
    steps: [
      { action: 'mix', label: 'Trabalhar a massa', hint: 'Faça círculos constantes para unir ovos e farinha.', target: 3 },
      { action: 'cut', label: 'Cortar as porções', hint: 'Mantenha os cortes regulares para fechar o recheio.', target: 7 },
      { action: 'season', label: 'Ajustar o recheio', hint: 'Segure para dosar o sal até a marca indicada e confirme para finalizar.', target: 3 },
      { action: 'mix', label: 'Envolver no molho', hint: 'Misture suavemente em círculos para não romper a massa.', target: 3 },
      { action: 'plate', label: 'Montar a apresentação', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 44, cost: 7.6, difficulty: 4, unlock: 4, equipment: 'fogao', seconds: 45, potential: 100,
  },
  {
    id: 'sobremesa_frutas', name: 'Creme de frutas assadas', category: 'Confeitaria',
    description: 'Frutas assadas sobre um creme leve e uma base delicada.',
    color: '#d5a378', ingredients: { fruta: 2, leite: 2, farinha: 1, ovo: 1 },
    steps: [
      { action: 'wash', label: 'Limpar as frutas', hint: 'Esfregue cada área até a higienização ficar completa.', target: 12 },
      { action: 'cut', label: 'Criar cortes delicados', hint: 'Faça lâminas regulares para a montagem final.', target: 7 },
      { action: 'mix', label: 'Preparar o creme', hint: 'Misture em círculos até chegar a uma textura lisa.', target: 3 },
      { action: 'bake', label: 'Assar as frutas', hint: 'Ajuste o forno para 190 °C e retire a preparação na faixa verde.' },
      { action: 'plate', label: 'Compor a sobremesa', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 36, cost: 7.3, difficulty: 4, unlock: 4, equipment: 'forno', seconds: 40, potential: 100,
  },
  {
    id: 'peixe_chef', name: 'Peixe com frutas da terra', category: 'Assinaturas',
    description: 'Peixe de cocção precisa, frutas frescas e arroz delicado.',
    color: '#c4b180', ingredients: { peixe: 2, fruta: 1, folhas: 1, arroz: 1 },
    steps: [
      { action: 'wash', label: 'Higienizar a guarnição', hint: 'Limpe todas as áreas com movimentos contínuos.', target: 12 },
      { action: 'cut', label: 'Trabalhar os cortes', hint: 'Faça cortes uniformes para uma composição delicada.', target: 7 },
      { action: 'season', label: 'Equilibrar os sabores', hint: 'Segure para dosar o sal até a marca indicada e confirme para finalizar.', target: 3 },
      { action: 'grill', label: 'Grelhar no ponto', hint: 'Vire na primeira faixa verde e retire na faixa verde final.' },
      { action: 'mix', label: 'Finalizar a guarnição', hint: 'Envolva os elementos com movimentos circulares.', target: 3 },
      { action: 'plate', label: 'Assinar o prato', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 55, cost: 12.8, difficulty: 5, unlock: 5, equipment: 'chapa', seconds: 48, potential: 100,
  },
  {
    id: 'file_assinatura', name: 'Filé assinatura Dorvim', category: 'Assinaturas',
    description: 'Filé de chapa, arroz cremoso de queijo e cebola dourada.',
    color: '#aa785b', ingredients: { carne: 2, arroz: 1, cebola: 1, queijo: 1 },
    steps: [
      { action: 'cut', label: 'Porcionar o filé', hint: 'Faça cortes firmes para preservar o desenho da carne.', target: 7 },
      { action: 'season', label: 'Temperar com precisão', hint: 'Segure para dosar o sal até a marca indicada e confirme para finalizar.', target: 3 },
      { action: 'grill', label: 'Criar a crosta', hint: 'Vire na primeira faixa verde e retire na faixa verde final.' },
      { action: 'mix', label: 'Cremar o arroz', hint: 'Misture em círculos até incorporar o queijo.', target: 3 },
      { action: 'plate', label: 'Finalizar a assinatura', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 55, cost: 13.6, difficulty: 5, unlock: 5, equipment: 'chapa', seconds: 47, potential: 100,
  },
  {
    id: 'degustacao_vegetal', name: 'Degustação da horta', category: 'Assinaturas',
    description: 'Uma composição de vegetais grelhados, arroz e creme de queijo.',
    color: '#8f9c69', ingredients: { tomate: 2, folhas: 2, cebola: 2, arroz: 1, queijo: 1 },
    steps: [
      { action: 'wash', label: 'Cuidar da horta', hint: 'Higienize cada região antes de começar os cortes.', target: 12 },
      { action: 'cut', label: 'Desenhar os vegetais', hint: 'Faça cortes precisos e de tamanho uniforme.', target: 7 },
      { action: 'season', label: 'Realçar o frescor', hint: 'Segure para dosar o sal até a marca indicada e confirme para finalizar.', target: 3 },
      { action: 'grill', label: 'Grelhar delicadamente', hint: 'Vire na primeira faixa verde e retire na faixa verde final.' },
      { action: 'mix', label: 'Preparar o creme', hint: 'Envolva em círculos até o creme ficar liso.', target: 3 },
      { action: 'plate', label: 'Compor a degustação', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 48, cost: 9.6, difficulty: 5, unlock: 5, equipment: 'chapa', seconds: 49, potential: 100,
  },
  {
    id: 'torta_autoral', name: 'Torta de frutas autoral', category: 'Assinaturas',
    description: 'Base crocante, creme leve e um mosaico de frutas da estação.',
    color: '#d49b85', ingredients: { farinha: 2, ovo: 2, leite: 2, fruta: 3 },
    steps: [
      { action: 'wash', label: 'Selecionar as frutas', hint: 'Limpe toda a superfície para conservar o frescor.', target: 12 },
      { action: 'cut', label: 'Criar o mosaico', hint: 'Corte fatias regulares para uma composição simétrica.', target: 7 },
      { action: 'mix', label: 'Preparar o creme', hint: 'Misture em círculos constantes até chegar à textura ideal.', target: 3 },
      { action: 'bake', label: 'Assar a base', hint: 'Ajuste o forno para 190 °C e retire a preparação na faixa verde.' },
      { action: 'plate', label: 'Finalizar o mosaico', hint: 'Arraste cada ingrediente para a silhueta correspondente no prato.', target: 4 },
    ], price: 45, cost: 11, difficulty: 5, unlock: 5, equipment: 'forno', seconds: 50, potential: 100,
  },
];

export const EQUIPMENT: Equipment[] = [
  { id: 'fogao', name: 'Fogão profissional', description: 'Mais potência e estabilidade para os preparos da cozinha.', price: 120, unlock: 1, max: 3 },
  { id: 'bancada', name: 'Bancada de preparo', description: 'Um espaço organizado torna cortes e montagens mais eficientes.', price: 100, unlock: 1, max: 3 },
  { id: 'chapa', name: 'Chapa de ferro', description: 'Calor uniforme para sanduíches, carnes e vegetais.', price: 180, unlock: 1, max: 3 },
  { id: 'geladeira', name: 'Refrigeração', description: 'Preserva a qualidade dos ingredientes por mais tempo.', price: 240, unlock: 1, max: 3 },
  { id: 'liquidificador', name: 'Estação de bebidas', description: 'Organiza e agiliza o preparo de bebidas e cremes.', price: 160, unlock: 1, max: 3 },
  { id: 'forno', name: 'Forno de convecção', description: 'Abre caminho para bolos, tortas e pratos assados.', price: 300, unlock: 2, max: 3 },
  { id: 'lava_loucas', name: 'Lava-louças', description: 'Ajuda a manter a higiene durante os turnos mais cheios.', price: 360, unlock: 2, max: 3 },
  { id: 'exaustor', name: 'Exaustão profissional', description: 'Uma cozinha ventilada reduz o desgaste da operação.', price: 420, unlock: 3, max: 3 },
  { id: 'balcao', name: 'Balcão de atendimento', description: 'Agiliza a saída dos pratos e melhora o fluxo do salão.', price: 500, unlock: 3, max: 3 },
  { id: 'tablet', name: 'Sistema de comandas', description: 'Organiza os pedidos para uma equipe maior trabalhar em sintonia.', price: 680, unlock: 4, max: 3 },
];

export const CANDIDATES: Candidate[] = [
  { id: 'bia', name: 'Bia Santos', role: 'auxiliar', speed: 71, skill: 52, hygiene: 84, organization: 78, stress: 84, wage: 8, unlock: 1, bio: 'Começou na cozinha da família. Rápida, cuidadosa e disposta a aprender.' },
  { id: 'rafael', name: 'Rafael Lima', role: 'auxiliar', speed: 82, skill: 58, hygiene: 75, organization: 69, stress: 77, wage: 10, unlock: 1, bio: 'Tem energia para o ritmo do almoço e gosta de manter os preparos adiantados.' },
  { id: 'yumi', name: 'Yumi Tanaka', role: 'auxiliar', speed: 75, skill: 72, hygiene: 93, organization: 90, stress: 88, wage: 14, unlock: 3, bio: 'Metódica e precisa. Seu cuidado aparece nos pequenos detalhes.' },
  { id: 'joana', name: 'Joana Ferreira', role: 'cozinheiro', speed: 73, skill: 76, hygiene: 83, organization: 76, stress: 83, wage: 16, unlock: 1, bio: 'Conhece os clássicos do almoço brasileiro e trabalha com constância.' },
  { id: 'pedro', name: 'Pedro Nascimento', role: 'cozinheiro', speed: 86, skill: 79, hygiene: 79, organization: 74, stress: 78, wage: 20, unlock: 2, bio: 'Especialista em chapa. Mantém a calma mesmo com várias comandas.' },
  { id: 'ines', name: 'Inês Carvalho', role: 'cozinheiro', speed: 78, skill: 92, hygiene: 92, organization: 86, stress: 87, wage: 25, unlock: 3, bio: 'Une a precisão da confeitaria à experiência de uma cozinha movimentada.' },
  { id: 'helena', name: 'Helena Duarte', role: 'chef', speed: 82, skill: 94, hygiene: 91, organization: 93, stress: 88, wage: 30, unlock: 3, bio: 'Chef experiente que orienta a brigada e valoriza o ingrediente local.' },
  { id: 'miguel', name: 'Miguel Azevedo', role: 'chef', speed: 91, skill: 98, hygiene: 94, organization: 96, stress: 90, wage: 34, unlock: 5, bio: 'Passou por grandes cozinhas e encontrou sua voz na gastronomia brasileira.' },
  { id: 'lucas', name: 'Lucas Oliveira', role: 'garcom', speed: 85, skill: 64, hygiene: 82, organization: 78, stress: 82, wage: 9, unlock: 1, bio: 'Atendimento acolhedor e passos rápidos entre a cozinha e o salão.' },
  { id: 'camila', name: 'Camila Rocha', role: 'garcom', speed: 93, skill: 84, hygiene: 91, organization: 92, stress: 88, wage: 16, unlock: 3, bio: 'Lê o ritmo das mesas e sabe transformar uma boa refeição em uma ótima experiência.' },
  { id: 'davi', name: 'Davi Costa', role: 'faxineiro', speed: 76, skill: 64, hygiene: 94, organization: 83, stress: 86, wage: 8, unlock: 1, bio: 'Discreto e atento: sempre encontra um jeito de deixar a cozinha mais segura.' },
  { id: 'rosa', name: 'Rosa Almeida', role: 'faxineiro', speed: 86, skill: 79, hygiene: 99, organization: 95, stress: 90, wage: 13, unlock: 2, bio: 'Experiência em higiene profissional e um olhar atento a cada bancada.' },
  { id: 'marina', name: 'Marina Barbosa', role: 'gerente', speed: 77, skill: 84, hygiene: 88, organization: 96, stress: 87, wage: 25, unlock: 3, bio: 'Organiza equipes com clareza e acompanha os números sem perder o cuidado com as pessoas.' },
  { id: 'antonio', name: 'Antônio Martins', role: 'gerente', speed: 85, skill: 93, hygiene: 91, organization: 99, stress: 90, wage: 32, unlock: 4, bio: 'Experiente em redes de restaurantes. Ideal para liderar uma nova unidade.' },
  { id: 'nina', name: 'Nina Ribeiro', role: 'estoquista', speed: 79, skill: 77, hygiene: 92, organization: 98, stress: 86, wage: 11, unlock: 2, bio: 'Conhece os fornecedores e mantém o estoque organizado para reduzir perdas.' },
];

export const STAGES: { name: string; xp: number; description: string }[] = [
  { name: 'Primeiros sabores', xp: 0, description: 'Uma cozinha pequena, um cardápio honesto e o primeiro cliente esperando.' },
  { name: 'Talento em ascensão', xp: 120, description: 'Seu nome começa a circular. Novas receitas e uma equipe ampliam suas possibilidades.' },
  { name: 'Cozinha profissional', xp: 380, description: 'Uma brigada organizada e pratos mais elaborados levam a casa a outro patamar.' },
  { name: 'Chef de referência', xp: 850, description: 'Sua identidade chega ao prato. Equilibre criação, gestão e uma clientela exigente.' },
  { name: 'Império gastronômico', xp: 1500, description: 'Assine seu legado, forme novos talentos e faça cada restaurante contar sua história.' },
];

export const SPECIALIZATIONS: { id: string; name: string; description: string }[] = [
  { id: 'brasileira', name: 'Cozinha brasileira', description: 'Receitas afetivas, ingredientes da terra e a generosidade de uma mesa brasileira.' },
  { id: 'massas', name: 'Massas artesanais', description: 'Técnica, textura e molhos que valorizam cada preparo feito à mão.' },
  { id: 'confeitaria', name: 'Confeitaria', description: 'Precisão na medida e delicadeza na apresentação, do bolo caseiro à sobremesa autoral.' },
  { id: 'contemporanea', name: 'Cozinha contemporânea', description: 'Técnicas clássicas encontram liberdade para criar uma assinatura própria.' },
];

export const ACHIEVEMENTS: { id: string; name: string; description: string }[] = [
  { id: 'first_service', name: 'Portas abertas', description: 'Sirva seu primeiro cliente.' },
  { id: 'ten_served', name: 'A casa está ganhando vida', description: 'Sirva 10 clientes ao longo da carreira.' },
  { id: 'hundred_served', name: 'Cem histórias à mesa', description: 'Sirva 100 clientes ao longo da carreira.' },
  { id: 'perfect_dish', name: 'No ponto exato', description: 'Sirva um prato com qualidade de pelo menos 95.' },
  { id: 'five_stars', name: 'Nome respeitado', description: 'Alcance 90 pontos de reputação em um restaurante.' },
  { id: 'full_team', name: 'Uma brigada de verdade', description: 'Reúna cinco profissionais na equipe.' },
  { id: 'second_restaurant', name: 'Novos horizontes', description: 'Abra seu segundo restaurante.' },
  { id: 'competition_winner', name: 'Sabor de vitória', description: 'Vença uma competição gastronômica.' },
  { id: 'all_recipes', name: 'Repertório completo', description: 'Alcance a última etapa da carreira e domine todo o livro de receitas.' },
  { id: 'cash_reserve', name: 'Gestão no azul', description: 'Mantenha uma reserva de R$ 2.000 em caixa.' },
];

export const EVENTS: GameEvent[] = [
  {
    id: 'festival', title: 'O bairro vai festejar',
    text: 'A associação local convidou a casa para o festival gastronômico. Uma contribuição de R$ 45 divulga o restaurante e aumenta o movimento deste turno.',
    choices: [{ label: 'Participar · R$ 45', effect: 'festival' }, { label: 'Manter o ritmo da casa', effect: 'decline' }],
  },
  {
    id: 'critic', title: 'Uma visita com olhar atento',
    text: 'Uma crítica gastronômica está na região. Convide-a sem custo e capriche no próximo prato: uma boa experiência pode fortalecer sua reputação.',
    choices: [{ label: 'Preparar uma mesa especial', effect: 'critic' }, { label: 'Deixar para outra ocasião', effect: 'decline' }],
  },
  {
    id: 'repair', title: 'O barulho vem da cozinha',
    text: 'Um técnico identificou desgaste nos equipamentos. A manutenção preventiva de R$ 40 recupera a condição da cozinha antes do serviço.',
    choices: [{ label: 'Fazer a manutenção · R$ 40', effect: 'repair' }, { label: 'Continuar com os equipamentos atuais', effect: 'ignore' }],
  },
  {
    id: 'supplies', title: 'Uma oferta do fornecedor',
    text: 'O fornecedor preparou um lote de reposição por R$ 55: seis porções de cada ingrediente usado no cardápio, com qualidade selecionada.',
    choices: [{ label: 'Receber a reposição · R$ 55', effect: 'supplies' }, { label: 'Seguir com o estoque atual', effect: 'decline' }],
  },
  {
    id: 'workshop', title: 'Uma aula antes do serviço',
    text: 'Uma chef convidada oferece uma oficina prática para a equipe. Por R$ 60, todos ganham experiência e sua carreira avança 40 XP.',
    choices: [{ label: 'Investir na oficina · R$ 60', effect: 'workshop' }, { label: 'Aprender durante o turno', effect: 'decline' }],
  },
  {
    id: 'donation', title: 'Uma mesa para a comunidade',
    text: 'A cozinha solidária do bairro está organizando um almoço. Uma contribuição de R$ 40 ajuda o projeto e aproxima seu restaurante da comunidade.',
    choices: [{ label: 'Contribuir com o almoço · R$ 40', effect: 'donation' }, { label: 'Participar em outra oportunidade', effect: 'decline' }],
  },
  {
    id: 'heat', title: 'O termômetro subiu',
    text: 'O dia promete calor intenso. Reforçar a ventilação e a higiene custa R$ 25; sem esse cuidado, o movimento pode cair neste turno.',
    choices: [{ label: 'Preparar a casa · R$ 25', effect: 'heat' }, { label: 'Trabalhar com a estrutura atual', effect: 'ignore' }],
  },
  {
    id: 'fair', title: 'Frescor direto da feira',
    text: 'Uma produtora local trouxe frutas, tomates e folhas excelentes. Por R$ 65, entram oito porções de cada um no estoque, com qualidade excepcional.',
    choices: [{ label: 'Comprar a seleção · R$ 65', effect: 'fair' }, { label: 'Usar os ingredientes disponíveis', effect: 'decline' }],
  },
];
