const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOGS_DIR = '/workspace/project-ecosystem/.planning/LOGS';
const PLANS_DIR = '/workspace/project-ecosystem/.planning/plans';
const STATE_FILE = '/workspace/project-ecosystem/.planning/state.json';
const SUMMARY_FILE = '/workspace/project-ecosystem/SUMMARY.md';

/**
 * Anomali Tespiti ve Öngörücü Planlama Motoru
 */
function runPredictiveMaintenance() {
    console.log('🧠 Öngörücü Bakım ve Planlama Motoru Başlatıldı...');

    if (!fs.existsSync(STATE_FILE)) return;
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const logs = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.json')).sort().reverse();

    // 1. Otonom Hata Analizi (Anomaly Detection)
    let consecutiveFailures = 0;
    for (const logFile of logs) {
        const log = JSON.parse(fs.readFileSync(path.join(LOGS_DIR, logFile), 'utf8'));
        if (log.status === 'FAILED') {
            consecutiveFailures++;
        } else {
            break; // Ardışık hatayı bozduk
        }
    }

    if (consecutiveFailures >= 3) {
        console.log(`🚨 ANOMALİ TESPİT EDİLDİ: ${consecutiveFailures} ardışık hata!`);
        createRecoveryPlan(`Kritik sistem hatası tespit edildi (${consecutiveFailures} ardışık başarısızlık).`);
    }

    // 2. Öngörücü Planlama (Proactive Tasking)
    const plans = Object.values(state.processed_plans);
    const total = plans.length;
    const completed = plans.filter(p => p.status === 'COMPLETED').length;
    const rate = total > 0 ? (completed / total) * 100 : 100;

    console.log(`📊 Mevcut Başarı Oranı: %${rate.toFixed(2)}`);

    if (rate < 90) {
        console.log('⚠️ BAŞARI ORANI KRİTİK: Optimizasyon planı üretiliyor...');
        createProactiveTask(
            'system-optimization',
            'Sistem Başarı Oranı Optimizasyonu',
            'Başarı oranı %90 altına düştü. Logları analiz et ve sistemi stabilize et.',
            'git status && npm prune'
        );
    }

    // Haftalık Rapor Kontrolü (Simülasyon)
    const lastRunDate = state.last_run ? new Date(state.last_run) : new Date(0);
    const now = new Date();
    if (now.getDay() === 1 && (now - lastRunDate) > 86400000) { // Pazartesi ve son 24 saatte raporlanmamışsa
        createProactiveTask(
            'weekly-report',
            'Haftalık Ekosistem Raporu',
            'Yeni hafta başladı, kapsamlı durum raporu oluşturuluyor.',
            'node scripts/report-generator.js'
        );
    }
}

function createRecoveryPlan(reason) {
    const planName = `RECOVERY_PLAN_${Date.now()}.xml`;
    const content = `<task>\n  <name>SYSTEM RECOVERY</name>\n  <description>${reason}</description>\n  <action>git reset --hard HEAD</action>\n</task>`;
    fs.writeFileSync(path.join(PLANS_DIR, planName), content);
    console.log(`🛡️ RECOVERY_PLAN oluşturuldu: ${planName}`);
}

function createProactiveTask(id, name, desc, action) {
    const planName = `proactive_${id}_${Date.now()}.xml`;
    const content = `<task>\n  <name>${name}</name>\n  <description>${desc}</description>\n  <action>${action}</action>\n</task>`;
    if (!fs.existsSync(path.join(PLANS_DIR, planName))) {
        fs.writeFileSync(path.join(PLANS_DIR, planName), content);
        console.log(`📅 Öngörücü Plan oluşturuldu: ${planName}`);
    }
}

try {
    runPredictiveMaintenance();
} catch (err) {
    console.error('❌ Bakım motoru hatası:', err.message);
}
