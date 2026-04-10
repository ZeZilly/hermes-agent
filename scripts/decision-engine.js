const fs = require('fs');
const path = require('path');

/**
 * Dağıtık İstihbarat & Karar Motoru (Federated Decision Engine)
 * Diğer ajanların durumunu (Her-Me-Z, OpenClaw vb.) analiz eder.
 */
function evaluateNetworkHealth() {
    console.log('📡 Dağıtık İstihbarat Taraması Başlatıldı...');
    
    const networkState = {
        master: { status: 'ONLINE', success_rate: 0 },
        nodes: []
    };

    // 1. Master State Analizi
    const masterStatePath = '/workspace/project-ecosystem/.planning/state.json';
    if (fs.existsSync(masterStatePath)) {
        const state = JSON.parse(fs.readFileSync(masterStatePath, 'utf8'));
        const plans = Object.values(state.processed_plans);
        const completed = plans.filter(p => p.status === 'COMPLETED').length;
        networkState.master.success_rate = ((completed / plans.length) * 100).toFixed(2);
    }

    // 2. Dış Düğüm Taraması (Federated State Simülasyonu)
    // Örn: Her-Me-Z veya diğer OpenClaw instance'larının mühürleri
    const externalProofs = [
        '/workspace/hermes-agent/PROOF_OF_STATE.json'
    ];

    externalProofs.forEach(proofPath => {
        if (fs.existsSync(proofPath)) {
            const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
            networkState.nodes.push({
                id: proof.baseline_id,
                provider: proof.provider,
                status: proof.status === 'confirmed' ? 'SYNCED' : 'DRIFTED'
            });
        }
    });

    console.log(`🧬 Karar Ağacı: Master (%${networkState.master.success_rate}) + ${networkState.nodes.length} Dış Düğüm`);
    
    // Stratejik Karar: Eğer dış düğümlerden biri DRIFTED ise Master plan üretmeli
    if (networkState.nodes.some(n => n.status === 'DRIFTED')) {
        return { action: 'SYNC_REQUIRED', node: 'external' };
    }
    
    return { action: 'IDLE', network: 'stable' };
}

module.exports = { evaluateNetworkHealth };

if (require.main === module) {
    evaluateNetworkHealth();
}
