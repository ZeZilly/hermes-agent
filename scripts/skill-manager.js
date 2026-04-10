const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SKILLS_DIR = '/workspace/project-ecosystem/skills';
const REGISTRY_FILE = '/workspace/project-ecosystem/skills/registry.json';

/**
 * Skill Manager Agent
 * Amacı: Otonom olarak yeni yetenekleri keşfetmek, kurmak ve yönetmek.
 */
function initializeRegistry() {
    if (!fs.existsSync(REGISTRY_FILE)) {
        fs.writeFileSync(REGISTRY_FILE, JSON.stringify({ installed_skills: {} }, null, 2));
    }
}

function installSkill(skillName, sourceCode) {
    console.log(`📦 Skill Manager: '${skillName}' yeteneği kuruluyor...`);
    
    const skillPath = path.join(SKILLS_DIR, `${skillName}.js`);
    
    try {
        // 1. Yazma
        fs.writeFileSync(skillPath, sourceCode);
        
        // 2. Kayıt (Registry) Güncelleme
        const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
        registry.installed_skills[skillName] = {
            installed_at: new Date().toISOString(),
            path: skillPath,
            status: 'INSTALLED'
        };
        fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
        
        console.log(`✅ Yetenek başarıyla kuruldu ve kaydedildi: ${skillName}`);
        return true;
    } catch (err) {
        console.error(`❌ Kurulum hatası: ${err.message}`);
        return false;
    }
}

function loadSkill(skillName) {
    const skillPath = path.join(SKILLS_DIR, `${skillName}.js`);
    if (fs.existsSync(skillPath)) {
        console.log(`🔌 Skill Manager: '${skillName}' yeteneği yükleniyor...`);
        return require(skillPath);
    }
    throw new Error(`Yetenek bulunamadı: ${skillName}`);
}

module.exports = { installSkill, loadSkill, initializeRegistry };

if (require.main === module) {
    initializeRegistry();
    console.log('🏛️ Skill Registry Başlatıldı.');
}
