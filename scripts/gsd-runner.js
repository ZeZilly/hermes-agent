const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * GSD-OpenClaw Adapter (Runner) PoC
 * Amacı: .planning/plans/ dizinindeki XML/Markdown görevlerini okuyup execute etmek.
 */

const PLANS_DIR = path.join('/workspace/project-ecosystem', '.planning/plans');
const LOGS_DIR = path.join('/workspace/project-ecosystem', '.planning/LOGS');

async function runGSD() {
    console.log('🚀 GSD-OpenClaw Runner Başlatıldı...');

    if (!fs.existsSync(PLANS_DIR)) {
        console.log('ℹ️ Plan dizini bulunamadı, oluşturuluyor...');
        fs.mkdirSync(PLANS_DIR, { recursive: true });
    }

    const plans = fs.readdirSync(PLANS_DIR).filter(f => f.endsWith('.md') || f.endsWith('.xml'));

    if (plans.length === 0) {
        console.log('📭 Bekleyen plan bulunamadı. Lütfen .planning/plans/ içine bir görev ekleyin.');
        return;
    }

    for (const planFile of plans) {
        const planPath = path.join(PLANS_DIR, planFile);
        const content = fs.readFileSync(planPath, 'utf8');
        
        console.log(`\n📖 İşleniyor: ${planFile}`);
        
        // Basit bir Task-Action-Verify ayıklama simülasyonu
        // Gerçek versiyonda XML parser veya Regex kullanılacak
        console.log('--- GÖREV ÖZETİ ---');
        console.log(content.split('\n').slice(0, 5).join('\n') + '...');

        // Execute adımı (Simüle edilmiş)
        console.log('⚡ Eylem (Action): Komutlar ayrıştırılıyor...');
        
        // Log kaydı
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logPath = path.join(LOGS_DIR, `exec-${timestamp}.json`);
        
        const logData = {
            plan: planFile,
            executed_at: new Date().toISOString(),
            status: "ready_for_execution",
            note: "Bu bir adaptör iskeletidir. Gerçek infaz için 'ask' onayı ve tool-call entegrasyonu gereklidir."
        };

        fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
        console.log(`✅ İşlem günlüğe kaydedildi: ${logPath}`);
    }
}

runGSD().catch(err => console.error('❌ Runner hatası:', err));
