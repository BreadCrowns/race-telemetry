/**
 * scripts/promote_prepro.js
 * 
 * Promotes pre-production files (prepro/) to production (root),
 * cleanly stripping out the experimental PREPRO badges.
 * 
 * Usage:
 *   node scripts/promote_prepro.js [analysis|pitwall|leaderboard|all]
 */

const fs = require('fs');
const path = require('path');

const target = process.argv[2] || 'all';
const rootDir = path.join(__dirname, '..');
const preproDir = path.join(rootDir, 'prepro');

console.log('Promoting from prepro/ to production (Target:', target, ')...');

// 1. Promote analysis.html
if (target === 'all' || target === 'analysis') {
  const preproPath = path.join(preproDir, 'analysis.html');
  if (fs.existsSync(preproPath)) {
    let content = fs.readFileSync(preproPath, 'utf8');
    content = content.replace(/ <span class="badge-prepro-tag">🧪 PREPRO<\/span>/g, '');
    fs.writeFileSync(path.join(rootDir, 'analysis.html'), content, 'utf8');
    console.log('✓ Promoted prepro/analysis.html -> analysis.html');
  }
}

// 2. Promote pitwall.html
if (target === 'all' || target === 'pitwall') {
  const preproPath = path.join(preproDir, 'pitwall.html');
  if (fs.existsSync(preproPath)) {
    let content = fs.readFileSync(preproPath, 'utf8');
    content = content.replace(/ <span style="background:linear-gradient\(135deg,#a855f7,#ec4899\);color:#fff;font-size:11px;padding:2px 8px;border-radius:4px;vertical-align:middle;box-shadow:0 0 10px rgba\(168,85,247,0.4\);">🧪 PREPRO<\/span>/g, '');
    content = content.replace(/<div style="width:100%; display:flex; justify-content:space-between; align-items:center; background:#1e1b4b; border:1px solid #6366f1; border-radius:6px; padding:6px 12px; margin-bottom:8px; font-size:12px;">[\s\S]*?<\/div>/g, '');
    fs.writeFileSync(path.join(rootDir, 'pitwall.html'), content, 'utf8');
    console.log('✓ Promoted prepro/pitwall.html -> pitwall.html');
  }
}

// 3. Promote leaderboard.html
if (target === 'all' || target === 'leaderboard') {
  const preproPath = path.join(preproDir, 'leaderboard.html');
  if (fs.existsSync(preproPath)) {
    let content = fs.readFileSync(preproPath, 'utf8');
    content = content.replace(/ <span style="background:linear-gradient\(135deg,#a855f7,#ec4899\);color:#fff;font-size:11px;padding:2px 8px;border-radius:4px;vertical-align:middle;">🧪 PREPRO<\/span>/g, '');
    fs.writeFileSync(path.join(rootDir, 'leaderboard.html'), content, 'utf8');
    console.log('✓ Promoted prepro/leaderboard.html -> leaderboard.html');
  }
}

console.log('\nPromotion complete! Test your production files and push to git.');
