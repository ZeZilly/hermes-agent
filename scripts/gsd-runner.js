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

const LOCK_FILE = path.join('/workspace/project-ecosystem', '.runner.lock');

const { processInbox, sendFeedback } = require('./hermez-adapter');

// Whitelist'e ekle
const COMMAND_WHITELIST = [
    'echo',
    'git pull',
    'git status',
    'git log',
    'git reset',
    'npm install',
    'npm prune',
    'ls',
    'df -h',
    'uname -a',
    'cat',
    'node'
];

function sanitizeCommand(cmd) {
    // Tehlikeli karakterleri temizle: |, &, ;, $(), <, >, `
    return cmd.replace(/[|&;$\(\)<>`]/g, '').trim();
}

function isCommandAllowed(cmd) {
    return COMMAND_WHITELIST.some(allowed => cmd.startsWith(allowed));
}

async function runGSD() {
    // Kilitleme Mekanizması (Locking)
    if (fs.existsSync(LOCK_FILE)) {
        console.log('⚠️ Runner zaten çalışıyor (Lock dosyası mevcut). Çıkılıyor...');
        return;
    }
    fs.writeFileSync(LOCK_FILE, process.pid.toString());

    try {
        console.log('🚀 GSD-OpenClaw Runner (Industrial Grade) Başlatıldı...');
        
        // Önce Bakım Motorunu çalıştır (Yeni Planlar Üretebilir)
        try {
            const maintenance = require('./maintenance-engine');
            // maintenance-engine.js içinde kendini çağıran bir yapı olduğu için import yeterli
        } catch (mErr) {
            console.error('⚠️ Bakım Motoru çalıştırılamadı:', mErr.message);
        }

        // Sonra Her-Me-Z Inbox'ını işle
        processInbox();
        
        const state = loadState();

        if (!fs.existsSync(PLANS_DIR)) {
            console.log('ℹ️ Plan dizini bulunamadı, oluşturuluyor...');
            fs.mkdirSync(PLANS_DIR, { recursive: true });
        }

        const plans = fs.readdirSync(PLANS_DIR).filter(f => f.endsWith('.md') || f.endsWith('.xml'));

        if (plans.length === 0) {
            console.log('📭 Bekleyen plan bulunamadı.');
        } else {
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

                    // Aksiyon Ayıklama (Regex ile)
                    const actionMatch = content.match(/<action>(.*?)<\/action>/s);
                    if (actionMatch) {
                        const rawCommand = actionMatch[1].trim();
                        const sanitizedCmd = sanitizeCommand(rawCommand);

                        console.log(`⚡ Eylem (Action) Tespit Edildi: ${sanitizedCmd}`);

                        // Aşama 3: Güvenli Komut İnfazı (Whitelist Kontrolü)
                        if (!isCommandAllowed(sanitizedCmd)) {
                            throw new Error(`Güvenlik Engeli: '${sanitizedCmd}' komutu izin verilenler listesinde (Whitelist) yok.`);
                        }

                        console.log(`🛠️ Komut Çalıştırılıyor: ${sanitizedCmd}`);
                        const output = execSync(sanitizedCmd, { cwd: '/workspace/project-ecosystem' }).toString();
                        console.log('--- ÇIKTI ---');
                        console.log(output);
                    }
                    
                    state.processed_plans[planFile].status = 'COMPLETED';
                    console.log(`✅ Başarıyla tamamlandı: ${planFile}`);

                    // Her-Me-Z Geri Bildirim
                    if (state.processed_plans[planFile].source === 'hermez') {
                        const planId = planFile.replace('hermez_', '').replace('.xml', '');
                        sendFeedback(planId, 'COMPLETED', logPath);
                    }

                } catch (err) {
                    state.processed_plans[planFile].status = 'FAILED';
                    state.processed_plans[planFile].error = err.message;
                    console.error(`❌ Plan başarısız (${planFile}):`, err.message);

                    if (state.processed_plans[planFile].source === 'hermez') {
                        const planId = planFile.replace('hermez_', '').replace('.xml', '');
                        sendFeedback(planId, 'FAILED', logPath, err.message);
                    }
                }

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
        }

        saveState(state);

    } finally {
        // Lock dosyasını temizle
        if (fs.existsSync(LOCK_FILE)) {
            fs.unlinkSync(LOCK_FILE);
        }
    }
}

runGSD().catch(err => console.error('❌ Runner hatası:', err));
