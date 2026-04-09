const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * GSD-OpenClaw Adapter (Runner) PoC
 * Amacı: .planning/plans/ dizinindeki XML/Markdown görevlerini okuyup execute etmek.
 */

const crypto = require('crypto');

const PLANS_DIR = path.join('/workspace/project-ecosystem', '.planning/plans');
const LOGS_DIR = path.join('/workspace/project-ecosystem', '.planning/LOGS');
const STATE_FILE = path.join('/workspace/project-ecosystem', '.planning/state.json');

function getPlanHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    return { last_run: null, processed_plans: {} };
}

function saveState(state) {
    state.last_run = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function runGSD() {
    console.log('🚀 GSD-OpenClaw Runner (Industrial Grade) Başlatıldı...');
    
    const state = loadState();

    if (!fs.existsSync(PLANS_DIR)) {
        console.log('ℹ️ Plan dizini bulunamadı, oluşturuluyor...');
        fs.mkdirSync(PLANS_DIR, { recursive: true });
    }

    const plans = fs.readdirSync(PLANS_DIR).filter(f => f.endsWith('.md') || f.endsWith('.xml'));

    if (plans.length === 0) {
        console.log('📭 Bekleyen plan bulunamadı.');
        return;
    }

    for (const planFile of plans) {
        const planPath = path.join(PLANS_DIR, planFile);
        let content;
        try {
            content = fs.readFileSync(planPath, 'utf8');
        } catch (err) {
            console.error(`❌ Dosya okuma hatası (${planFile}):`, err.message);
            continue;
        }

        const planHash = getPlanHash(content);

        // Aşama 1: Durum Yönetimi - Sadece yeni veya değişmiş planları işle
        if (state.processed_plans[planFile] && state.processed_plans[planFile].hash === planHash && state.processed_plans[planFile].status === 'COMPLETED') {
            console.log(`⏩ Atlanıyor (Zaten Tamamlandı): ${planFile}`);
            continue;
        }

        console.log(`\n📖 İşleniyor: ${planFile}`);
        state.processed_plans[planFile] = {
            hash: planHash,
            status: 'IN_PROGRESS',
            updated_at: new Date().toISOString()
        };

        try {
            // Aşama 2: Sağlam Hata Yönetimi & Basit XML Doğrulama
            if (planFile.endsWith('.xml') && (!content.includes('<task>') || !content.includes('</task>'))) {
                throw new Error('Geçersiz GSD XML formatı: <task> etiketi eksik.');
            }

            console.log('--- GÖREV ÖZETİ ---');
            console.log(content.split('\n').slice(0, 5).join('\n') + '...');

            // Execute adımı simülasyonu
            console.log('⚡ Eylem (Action): Analiz ediliyor...');
            
            // Başarılı tamamlama
            state.processed_plans[planFile].status = 'COMPLETED';
            console.log(`✅ Başarıyla tamamlandı: ${planFile}`);

        } catch (err) {
            state.processed_plans[planFile].status = 'FAILED';
            state.processed_plans[planFile].error = err.message;
            console.error(`❌ Plan başarısız (${planFile}):`, err.message);
        }

        // Log kaydı
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logPath = path.join(LOGS_DIR, `exec-${planFile}-${timestamp}.json`);
        fs.writeFileSync(logPath, JSON.stringify({
            plan: planFile,
            hash: planHash,
            executed_at: new Date().toISOString(),
            status: state.processed_plans[planFile].status,
            error: state.processed_plans[planFile].error || null
        }, null, 2));
    }

    saveState(state);
}

runGSD().catch(err => console.error('❌ Runner hatası:', err));
