const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STATE_FILE = '/workspace/project-ecosystem/.planning/state.json';
const MANIFESTO_FILE = '/workspace/project-ecosystem/docs/ARCH_MANIFESTO.md';

function runMutation() {
    console.log('🔄 Mutasyon Başlatıldı...');

    // 1. Veri Çekme
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const plans = Object.values(state.processed_plans);
    const total = plans.length;
    const completed = plans.filter(p => p.status === 'COMPLETED').length;
    const rate = ((completed / total) * 100).toFixed(2);

    // 2. Dosya Oluşturma/Güncelleme
    const content = `# ARCH_MANIFESTO\n\n` +
                    `Sistem Durumu: Otonom\n` +
                    `Toplam İşlenen Görev: ${total}\n` +
                    `Başarı Oranı: %${rate}\n` +
                    `Zaman Damgası: ${new Date().toISOString()}\n`;

    if (!fs.existsSync(path.dirname(MANIFESTO_FILE))) {
        fs.mkdirSync(path.dirname(MANIFESTO_FILE), { recursive: true });
    }
    fs.writeFileSync(MANIFESTO_FILE, content);
    console.log('📝 ARCH_MANIFESTO.md güncellendi.');

    // 3. Doğrulama (Self-Check)
    console.log('🔍 Doğrulama (Self-Check) Yapılıyor...');
    const verification = execSync(`cat ${MANIFESTO_FILE}`).toString();
    
    if (verification.includes(`Başarı Oranı: %${rate}`)) {
        console.log('✅ DOĞRULAMA BAŞARILI: Veri bütünlüğü mühürlendi.');
    } else {
        throw new Error('❌ DOĞRULAMA HATASI: Yazılan veri ile okunan veri eşleşmiyor!');
    }
}

try {
    runMutation();
} catch (err) {
    console.error(err.message);
    process.exit(1);
}
