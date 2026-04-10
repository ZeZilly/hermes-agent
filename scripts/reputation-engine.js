const fs = require('fs');
const path = require('path');

const REPUTATION_FILE = '/workspace/project-ecosystem/.planning/reputation.json';

/**
 * İstemci Risk ve İtibar Yönetim Motoru
 */
function evaluateRiskAndReputation(payload, systemHealth) {
    console.log(`🛡️ Risk Analizi Başlatıldı: ${payload.id || 'unknown'}`);
    
    let reputation = loadReputation();
    const source = payload.source || 'default';
    
    // 1. İtibar Analizi (Reputation Score)
    if (!reputation[source]) {
        reputation[source] = { score: 100, failures: 0, total: 0 };
    }
    
    const sourceData = reputation[source];
    console.log(`👤 Kaynak: ${source} (İtibar: ${sourceData.score})`);

    // İtibar çok düşükse incelemeye al
    if (sourceData.score < 50) {
        console.log(`⚠️ DÜŞÜK İTİBAR: ${source} manuel incelemeye alındı.`);
        return { action: 'PENDING_MANUAL_REVIEW', reason: 'Low reputation score' };
    }

    // 2. Risk Analizi (Sistem Yükü ve Başarı Oranı)
    if (systemHealth.success_rate < 70 && payload.priority < 2) {
        console.log(`⏳ YÜKSEK RİSK: Sistem başarısı düşük, görev ertelendi.`);
        return { action: 'DELAYED', reason: 'System instability' };
    }

    // Ağır görev tespiti (Örn: git clone gibi komutlar)
    if (payload.cmd && (payload.cmd.includes('clone') || payload.cmd.includes('install')) && systemHealth.success_rate < 85) {
        console.log(`⏳ ERTELEME: Ağır komut tespit edildi, stabilite bekleniyor.`);
        return { action: 'DELAYED', reason: 'Heavy operation during sub-optimal health' };
    }

    return { action: 'EXECUTE', priority_boost: sourceData.score > 90 ? 1 : 0 };
}

function updateReputation(source, status) {
    let reputation = loadReputation();
    if (!reputation[source]) reputation[source] = { score: 100, failures: 0, total: 0 };
    
    const data = reputation[source];
    data.total++;
    
    if (status === 'FAILED') {
        data.failures++;
        data.score -= 10; // Her hata -10 puan
    } else {
        data.failures = 0; // Ardışık hatayı sıfırla
        data.score = Math.min(100, data.score + 2); // Her başarı +2 puan
    }
    
    saveReputation(reputation);
}

function loadReputation() {
    if (fs.existsSync(REPUTATION_FILE)) {
        return JSON.parse(fs.readFileSync(REPUTATION_FILE, 'utf8'));
    }
    return {};
}

function saveReputation(reputation) {
    fs.writeFileSync(REPUTATION_FILE, JSON.stringify(reputation, null, 2));
}

module.exports = { evaluateRiskAndReputation, updateReputation };
