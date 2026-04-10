const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const INBOX_DIR = path.join('/workspace/project-ecosystem', '.planning/hermez_inbox');
const PLANS_DIR = path.join('/workspace/project-ecosystem', '.planning/plans');
const OUTBOX_DIR = path.join('/workspace/project-ecosystem', '.planning/hermez_outbox');
const STATE_FILE = path.join('/workspace/project-ecosystem', '.planning/state.json');

function getHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    return { last_run: null, processed_plans: {} };
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Her-Me-Z Inbox'ını tarar ve JSON planlarını mühürlü XML formatına dönüştürür.
 */
function processInbox() {
    console.log('📥 Her-Me-Z Adaptörü: Inbox taranıyor...');
    const state = loadState();
    const inboxFiles = fs.readdirSync(INBOX_DIR).filter(f => f.endsWith('.json'));

    if (inboxFiles.length === 0) {
        console.log('ℹ️ Inbox boş.');
        return;
    }

    inboxFiles.forEach(file => {
        try {
            const rawContent = fs.readFileSync(path.join(INBOX_DIR, file), 'utf8');
            const data = JSON.parse(rawContent);

            if (!data.id || !data.cmd) {
                throw new Error(`Eksik veri: ${file}`);
            }

            const xmlContent = `<task>\n  <name>${data.task_name || 'Unnamed'}</name>\n  <id>${data.id}</id>\n  <action>${data.cmd}</action>\n</task>`;
            const xmlFileName = `hermez_${data.id}.xml`;
            const xmlPath = path.join(PLANS_DIR, xmlFileName);

            fs.writeFileSync(xmlPath, xmlContent);
            
            // State'e ekle
            state.processed_plans[xmlFileName] = {
                hash: getHash(xmlContent),
                status: 'NEW',
                updated_at: new Date().toISOString(),
                source: 'hermez'
            };

            console.log(`✅ Dönüştürüldü: ${file} -> ${xmlFileName}`);
            fs.unlinkSync(path.join(INBOX_DIR, file)); // Inbox'tan temizle

        } catch (err) {
            console.error(`❌ Adaptör hatası (${file}):`, err.message);
        }
    });

    saveState(state);
}

/**
 * Sonuçları Her-Me-Z Outbox'ına yazar.
 */
function sendFeedback(planId, status, logPath, error = null) {
    const feedback = {
        plan_id: planId,
        status: status,
        log_path: logPath,
        error_detail: error,
        timestamp: new Date().toISOString()
    };
    const feedbackPath = path.join(OUTBOX_DIR, `feedback_${planId}.json`);
    fs.writeFileSync(feedbackPath, JSON.stringify(feedback, null, 2));
    console.log(`📡 Feedback gönderildi: ${feedbackPath}`);
}

module.exports = { processInbox, sendFeedback };

if (require.main === module) {
    processInbox();
}
