import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('1. Acessando página inicial...');
  await page.goto('http://localhost:5889', { waitUntil: 'networkidle' });

  // Se estiver na tela de login, faz o login
  const isLogin = await page.$('input[type="password"]');
  if (isLogin) {
    console.log('2. Realizando login...');
    const emailInput = await page.$('input[type="email"], input[type="text"]');
    if (emailInput) {
      await emailInput.fill('aryarajmarketing@gmail.com');
      const passInput = await page.$('input[type="password"]');
      await passInput.fill('123456');
      await page.click('button[type="submit"], button:has-text("Entrar")');
      await page.waitForTimeout(1500);
    }
  }

  console.log('3. Verificando botão Financeiro na Sidebar...');
  const financeiroBtn = await page.waitForSelector('button.nav-item:has-text("Financeiro")', { timeout: 10000 });
  if (!financeiroBtn) {
    throw new Error('Botão Financeiro não encontrado na Sidebar!');
  }
  console.log('✅ Botão Financeiro encontrado na barra lateral!');

  console.log('4. Clicando no botão Financeiro...');
  await financeiroBtn.click();
  await page.waitForTimeout(1500);

  console.log('5. Validando renderização da página Financeiro...');
  await page.waitForSelector('.financeiro-wrapper', { timeout: 10000 });
  
  // Validar título
  const title = await page.textContent('.financeiro-title-group h2');
  console.log('Título encontrado:', title);
  if (!title.includes('Gestão Financeira')) {
    throw new Error('Título da página Financeiro incorreto!');
  }

  // Validar Cards de KPI
  const kpiCards = await page.$$('.financeiro-kpi-card');
  console.log(`✅ ${kpiCards.length} cards de KPI renderizados com sucesso!`);

  // Validar Seção de Provedores
  const providerPanel = await page.$('.financeiro-panel-box');
  if (!providerPanel) {
    throw new Error('Painel de distribuição por provedores não encontrado!');
  }
  console.log('✅ Painel de distribuição por provedores renderizado!');

  // Capturar screenshot de validação
  const screenshotDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  const screenshotPath = path.join(screenshotDir, 'financeiro_validated.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`📸 Screenshot salvo com sucesso em: ${screenshotPath}`);

  await browser.close();
  console.log('🎉 Todos os testes visuais e de interface do Financeiro passaram com sucesso!');
}

run().catch((err) => {
  console.error('❌ Falha no teste do Financeiro:', err);
  process.exit(1);
});
