import fetch from 'node-fetch';

async function run() {
  console.log('🚀 Iniciando script de automação para criação do carrossel...');

  // 1. Login para pegar o Token JWT
  console.log('🔑 Passo 1: Autenticando com credenciais de desenvolvimento...');
  const loginRes = await fetch('http://localhost:3131/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'aryarajmarketing@gmail.com',
      password: '123456'
    })
  });

  if (!loginRes.ok) {
    const errorText = await loginRes.text();
    console.error('❌ Falha ao realizar login:', errorText);
    return;
  }

  const { token } = await loginRes.json();
  console.log('✅ Autenticado com sucesso! Token JWT obtido.');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Criar o Rascunho do Carrossel
  console.log('📝 Passo 2: Criando rascunho do carrossel no Postgres...');
  const carouselPayload = {
    title: 'SEU SALÁRIO NÃO É BAIXO. ELE É HERDADO.',
    theme: 'dinheiro-herda-trauma',
    format: 'A',
    slidesDir: '',
    caption: 'Tem gente que olha para o próprio salário e conclui rápido demais...',
    notes: 'Briefing automatizado via script de depuração',
    totalSlides: 10,
    imageQuality: 'high',
    status: 'rascunho',
    chatHistory: [
      { role: 'user', content: 'Criação automatizada via script.' }
    ]
  };

  const createRes = await fetch('http://localhost:3131/api/carousels', {
    method: 'POST',
    headers,
    body: JSON.stringify(carouselPayload)
  });

  if (!createRes.ok) {
    console.error('❌ Erro ao criar rascunho do carrossel:', await createRes.text());
    return;
  }

  const createdCarousel = await createRes.json();
  const carouselId = createdCarousel.id;
  console.log(`✅ Rascunho criado com ID: ${carouselId}`);

  // 3. Estruturar os slides para a Geração
  console.log('🎨 Passo 3: Preparando payload de slides...');
  const generatePayload = {
    id: carouselId,
    title: 'SEU SALÁRIO NÃO É BAIXO. ELE É HERDADO.',
    theme: 'dinheiro-herda-trauma',
    format: 'A',
    caption: 'Tem gente que olha para o próprio salário e conclui rápido...',
    notes: 'Briefing automatizado via script',
    totalSlides: 10,
    imageQuality: 'high',
    slides: [
      {
        num: 1,
        estado: 'DISRUPÇÃO',
        layout: 'fullbleed',
        preset: 'manuscrito_sagrado',
        title: 'SEU SALÁRIO\nNÃO É BAIXO.\nÉ HERDADO.',
        body: 'Existe gente com o mesmo currículo recebendo mais. Às vezes a diferença está na memória que foi morar no seu corpo.',
        prompt: 'A suited figure stands inside a glass box filled with old family receipts, coins, and faded payroll papers. Golden light leaks from above, but chains made of red thread tie the figure’s wrists to shadowy hands behind the glass.'
      },
      {
        num: 2,
        estado: 'DESCIDA',
        layout: 'dramatico',
        preset: 'manuscrito_sagrado',
        title: 'VOCÊ SENTIU\nISSO',
        body: 'Você não estava errado em estranhar. Tem gente trabalhando muito e mesmo assim voltando sempre para o mesmo número.',
        prompt: 'A person sits alone at a kitchen table at night, lit by a single dim lamp, staring at a payslip that seems heavier than paper.'
      },
      {
        num: 3,
        estado: 'NOMEAÇÃO',
        layout: 'dramatico',
        preset: 'manuscrito_sagrado',
        title: 'O TETO TEM\nORIGEM',
        body: 'Ele começa na casa antes de aparecer no holerite. Famílias transmitem medo financeiro por repetição, frase e silêncio.',
        prompt: 'A family dinner scene where everyone’s mouths are stitched with thin gold thread, while a paycheck burns quietly.'
      },
      {
        num: 4,
        estado: 'PROFUNDIDADE',
        layout: 'text_only',
        preset: 'manuscrito_sagrado',
        title: 'O CORPO APRENDE\nLIMITE',
        body: 'Se crescer significou risco, humilhação ou dívida, o sistema nervoso lê ganho maior como perigo financeiro.',
        prompt: 'Dark esoteric background with subtle abstract textures'
      },
      {
        num: 5,
        estado: 'QUEDA FUNDA',
        layout: 'text_only',
        preset: 'manuscrito_sagrado',
        title: 'E AÍ VEM\nO PONTO DURO',
        body: 'Se você acredita que ultrapassar o teto da família é abandonar quem sofreu antes, ganhar mais vira uma forma de culpa.',
        prompt: 'Deep dark background - heavier weight'
      },
      {
        num: 6,
        estado: 'ESPELHO',
        layout: 'text_only',
        preset: 'manuscrito_sagrado',
        title: 'VOCÊ JÁ\nFEZ ISSO',
        body: 'Você já aceitou menos para não parecer ambicioso. Existe uma parte sua que confunde escassez com pertencimento.',
        prompt: 'A cracked mirror reflects a professional holding smaller stacks of money while a child’s silhouette watches.'
      },
      {
        num: 7,
        estado: 'ASCENSÃO',
        layout: 'dramatico',
        preset: 'manuscrito_sagrado',
        title: 'ISSO TEM\nMECANISMO',
        body: 'O teto não cai com pensamento positivo. Ele cede quando o corpo aprende, na prática, que expansão não é perigo.',
        prompt: 'A person steps barefoot across a dark floor toward a doorway of warm gold light, leaving behind old payroll slips.'
      },
      {
        num: 8,
        estado: 'CRISTALIZAÇÃO',
        layout: 'etereo',
        preset: 'manuscrito_sagrado',
        title: 'O NÚMERO\nNÃO É SÓ NÚMERO',
        body: 'Seu salário carregava uma antiga fidelidade. Quando isso é visto, o dinheiro deixa de ser prova de amor ao passado.',
        prompt: 'Floating golden numbers drift above a dark ocean while ancestral shadows dissolve.'
      },
      {
        num: 9,
        estado: 'SETUP CTA',
        layout: 'dramatico',
        preset: 'manuscrito_sagrado',
        title: 'EXISTE UM\nPROTOCOLO',
        body: 'Existe uma sequência para o corpo parar de tratar expansão financeira como ameaça e soltar a culpa herdada.',
        prompt: 'A circular symbol made of sound waves glows faintly over an old family tree.'
      },
      {
        num: 10,
        estado: 'CTA FIXO',
        layout: 'fullbleed',
        preset: 'manuscrito_sagrado',
        title: 'COMENTE\nFONTE',
        body: 'E eu te envio a Tecnologia Sonora capaz de dissolver bloqueios emocionais que mantêm seu teto financeiro.',
        prompt: 'Pure golden portal, light emanating from the center, dark deep background.'
      }
    ]
  };

  // 4. Iniciar Geração Física
  console.log('⚡ Passo 4: Disparando o pipeline de geração de design...');
  const genRes = await fetch('http://localhost:3131/api/criador/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify(generatePayload)
  });

  if (genRes.ok) {
    console.log('🎉 SUCESSO! Pipeline de geração de imagens disparado com êxico no servidor.');
    console.log('Acompanhe o progresso abrindo o painel e acessando a aba de Carrosséis.');
  } else {
    console.error('❌ Falha ao iniciar geração:', await genRes.text());
  }
}

run();
