import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACT_DIR = 'C:/Users/aryar/.gemini/antigravity/brain/6cb7202d-73c4-47c7-bcc5-e7afc41c6be2';

async function run() {
  console.log('🚀 Iniciando captura de tela com Playwright para Backups...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.setViewportSize({ width: 1280, height: 1000 });

  try {
    // 1. Acessa a página de login usando URL limpa
    console.log('🌐 Acessando página de login...');
    await page.goto('http://localhost:5176/login');
    await page.waitForTimeout(1000); 

    // 2. Preenche os dados e faz login como Super Admin
    console.log('✍️ Efetuando login...');
    await page.fill('input[name="username"]', 'aryarajmarketing@gmail.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');
    
    // Aguarda o login e o carregamento do dashboard
    await page.waitForTimeout(3000);

    // 3. Clica na aba "Backups do Banco" no menu lateral
    console.log('⚙️ Acessando Backups do Banco...');
    const backupsBtn = await page.locator('.nav-item:has-text("Backups do Banco")');
    await backupsBtn.click();
    await page.waitForTimeout(2000);

    // Captura aba de Backups
    console.log('📸 Capturando aba de Backups...');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'backups_tab.png'), fullPage: true });

    // Clica em Salvar Configuração para disparar o toast
    console.log('💾 Clicando em Salvar Configuração para disparar o toast...');
    await page.click('button:has-text("Salvar Configuração")');
    await page.waitForTimeout(800);

    // Captura o estado com o toast visível no topo direito
    console.log('📸 Capturando aba de Backups com Toast...');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'backups_tab_toast.png') });

    // Seleciona o primeiro checkbox da lista de backups para validar a seleção em massa
    console.log('☑️ Selecionando o primeiro backup da lista...');
    const firstCheckbox = await page.locator('.backup-row input[type="checkbox"]').first();
    if (await firstCheckbox.count() > 0) {
      await firstCheckbox.click();
      await page.waitForTimeout(500);
      console.log('📸 Capturando aba de Backups com seleção e botão de exclusão ativo...');
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'backups_tab_selected.png') });
    }

    console.log('🎉 Capturas visuais criadas com sucesso na pasta de artefatos!');

  } catch (error) {
    console.error('❌ Erro na captura de tela:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
