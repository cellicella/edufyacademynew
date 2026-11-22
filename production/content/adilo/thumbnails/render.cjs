/**
 * Edufy Academy course thumbnails (1280×720), one consistent design system:
 *  - brand gradient background in a colour theme per course, with soft light shapes;
 *  - course title (the course's own name), short promise line and three topic chips from the real lessons;
 *  - subject illustration made of icons on the right;
 *  - the official Edufy Academy logo (public/brand/edufy-logo-512.png) in the top-right corner, unchanged.
 *
 * Run:  node render.cjs <outDir>     (uses the pre-installed Playwright + react-icons; fonts: Inter / Inter Display)
 */
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');
const req = createRequire('/opt/npm-tools/node_modules/');
const React = req('react');
const { renderToStaticMarkup } = req('react-dom/server');
const Pi = req('react-icons/pi');
const { chromium } = require('playwright');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'out'));
const LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '../../../../public/brand/edufy-logo-512.png')).toString('base64');
const icon = (name, size, color) => renderToStaticMarkup(React.createElement(Pi[name], { size, color }));

const COURSES = [
  { slug: 'resume-writing-course-perfect-resume', eyebrow: 'Career Development', title: ['Crafting the', '*Perfect Resume*'], line: 'Essential elements that attract employers', theme: ['#0B2A6F', '#004AAD', '#5271FF'], main: 'PiFileTextDuotone',
    orbit: ['PiPencilSimpleLineDuotone', 'PiCheckCircleDuotone', 'PiEnvelopeSimpleDuotone', 'PiBriefcaseDuotone'], chips: [['PiFileTextDuotone', 'One-page resume'], ['PiListChecksDuotone', 'Bullet points'], ['PiEnvelopeSimpleDuotone', 'Cover letters']] },
  { slug: 'complete-guide-to-job-interviews', eyebrow: 'Career Development', title: ['From Preparation', 'to *Follow-Up*'], line: 'A comprehensive guide to job interviews', theme: ['#1A1150', '#3B1FA8', '#5E17EB'], main: 'PiHandshakeDuotone',
    orbit: ['PiMagnifyingGlassDuotone', 'PiChatsCircleDuotone', 'PiCalendarCheckDuotone', 'PiTShirtDuotone'], chips: [['PiMagnifyingGlassDuotone', 'Company research'], ['PiChatsCircleDuotone', 'Rehearsal'], ['PiArrowBendUpRightDuotone', 'Follow-up']] },
  { slug: 'how-to-land-your-first-internship', eyebrow: 'Career Development', title: ['How to Land Your', '*First Internship*'], line: 'From your first application to a full-time offer', theme: ['#05324A', '#00699A', '#16A3C4'], main: 'PiGraduationCapDuotone',
    orbit: ['PiLinkedinLogoDuotone', 'PiFileTextDuotone', 'PiUsersThreeDuotone', 'PiRocketLaunchDuotone'], chips: [['PiFileTextDuotone', 'Resume & LinkedIn'], ['PiUsersThreeDuotone', 'Networking'], ['PiRocketLaunchDuotone', 'Full-time offers']] },
  { slug: 'salary-negotiation-course', eyebrow: 'Career Development', title: ['Mastering Salary', '*Negotiations*'], line: 'Secure your worth with confidence', theme: ['#073B2E', '#0B6B4F', '#18A974'], main: 'PiCurrencyInrDuotone',
    orbit: ['PiTrendUpDuotone', 'PiHandshakeDuotone', 'PiChartBarDuotone', 'PiTargetDuotone'], chips: [['PiStepsDuotone', '4-step framework'], ['PiTrendUpDuotone', 'Market worth'], ['PiHandshakeDuotone', 'Asking for a raise']] },
  { slug: 'phone-communication-skills-course', eyebrow: 'Communication Skills', title: ['Mastering Phone', '*Conversations*'], line: 'Key strategies for confident communication', theme: ['#2A0F4F', '#5E17EB', '#8B5CF6'], main: 'PiPhoneCallDuotone',
    orbit: ['PiEarDuotone', 'PiNotePencilDuotone', 'PiHeadsetDuotone', 'PiChatTeardropTextDuotone'], chips: [['PiEarDuotone', 'Active listening'], ['PiPhoneOutgoingDuotone', 'Cold calls'], ['PiSmileyDuotone', 'Building rapport']] },
  { slug: 'communication-skills-course', eyebrow: 'Communication Skills', title: ['Mastering the Art', 'of *Communication*'], line: 'Essential techniques to enhance your social skills', theme: ['#4A0E2E', '#9D174D', '#E0457B'], main: 'PiChatsCircleDuotone',
    orbit: ['PiHandWavingDuotone', 'PiEarDuotone', 'PiHeartDuotone', 'PiLightbulbDuotone'], chips: [['PiHandWavingDuotone', 'Breaking the ice'], ['PiLightbulbDuotone', 'Persuasion'], ['PiHeartDuotone', 'Appreciation']] },
  { slug: 'public-speaking-course-for-beginners', eyebrow: 'Communication Skills', title: ['Mastering the Art of', '*Public Speaking*'], line: 'Essential techniques for beginners', theme: ['#3B1405', '#B4400B', '#F08A24'], main: 'PiMicrophoneStageDuotone',
    orbit: ['PiPresentationChartDuotone', 'PiSpeakerHighDuotone', 'PiVideoCameraDuotone', 'PiUsersThreeDuotone'], chips: [['PiSmileyDuotone', 'Beat anxiety'], ['PiBookOpenTextDuotone', 'Storytelling'], ['PiVideoCameraDuotone', 'Video rehearsals']] },
  { slug: 'personal-branding-course', eyebrow: 'Career Development', title: ['Mastering', '*Your Identity*'], line: 'A tactical plan for your personal branding journey', theme: ['#102347', '#1D4ED8', '#38BDF8'], main: 'PiIdentificationBadgeDuotone',
    orbit: ['PiShareNetworkDuotone', 'PiBroadcastDuotone', 'PiStarDuotone', 'PiGlobeDuotone'], chips: [['PiBookOpenTextDuotone', 'Brand story'], ['PiShareNetworkDuotone', 'Social media'], ['PiGlobeDuotone', 'Content & website']] },
];

const titleHtml = (lines) =>
  lines.map((l) => `<span class="ln">${l.replace(/\*(.+?)\*/g, '<em>$1</em>')}</span>`).join('');

function page(c) {
  const [dark, mid, light] = c.theme;
  const orbitPos = [[8, 10], [-8, 64], [104, 46], [80, 100]]; // % of the illustration box (kept clear of the logo corner)
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1280px;height:720px;overflow:hidden;font-family:'Inter',sans-serif;color:#fff;
    background:radial-gradient(1100px 700px at 85% 20%, ${light}55, transparent 60%), radial-gradient(900px 600px at 0% 100%, ${mid}cc, transparent 70%), linear-gradient(135deg, ${dark} 0%, ${mid} 62%, ${light} 140%);}
  .grid{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.14) 1.4px, transparent 1.4px);background-size:28px 28px;mask-image:linear-gradient(90deg,transparent 0%,#000 55%,#000 100%);-webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 55%,#000 100%)}
  .ring{position:absolute;border-radius:50%;border:2px solid rgba(255,255,255,.12)}
  .logo{position:absolute;top:34px;right:38px;width:104px;height:104px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 14px 34px rgba(0,0,0,.28)}
  .logo img{width:88px;height:88px}
  .copy{position:absolute;left:72px;top:70px;width:640px}
  .eyebrow{display:inline-flex;align-items:center;gap:10px;height:40px;padding:0 18px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);font-weight:700;font-size:17px;letter-spacing:.14em;text-transform:uppercase}
  .eyebrow i{width:9px;height:9px;border-radius:50%;background:#FFD34D;display:inline-block}
  h1{margin-top:30px;font-family:'Inter Display','Inter',sans-serif;font-weight:900;font-size:76px;line-height:1.02;letter-spacing:-.025em;text-shadow:0 6px 30px rgba(0,0,0,.25)}
  h1 .ln{display:block;white-space:nowrap}
  h1 em{font-style:normal;color:#FFD34D}
  .line{margin-top:22px;font-size:27px;font-weight:500;color:rgba(255,255,255,.9);line-height:1.35;max-width:600px}
  .chips{position:absolute;left:72px;bottom:62px;display:flex;gap:14px}
  .chip{display:flex;align-items:center;gap:10px;height:56px;padding:0 20px 0 12px;border-radius:16px;background:rgba(255,255,255,.96);color:${dark};font-weight:700;font-size:19px;box-shadow:0 10px 26px rgba(0,0,0,.2)}
  .chip span.i{width:36px;height:36px;border-radius:10px;background:${mid}1f;display:flex;align-items:center;justify-content:center}
  .art{position:absolute;right:96px;top:176px;width:380px;height:380px}
  .disc{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 35% 30%, rgba(255,255,255,.35), rgba(255,255,255,.08) 60%);border:1.5px solid rgba(255,255,255,.35);box-shadow:inset 0 0 60px rgba(255,255,255,.12), 0 40px 80px rgba(0,0,0,.25)}
  .main{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 18px 30px rgba(0,0,0,.25))}
  .orb{position:absolute;width:96px;height:96px;border-radius:28px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 16px 34px rgba(0,0,0,.25);transform:translate(-50%,-50%)}
  .brand{position:absolute;right:40px;bottom:30px;font-size:16px;font-weight:600;letter-spacing:.06em;color:rgba(255,255,255,.75)}
  </style></head><body>
  <div class="grid"></div>
  <div class="ring" style="width:620px;height:620px;right:-60px;top:40px"></div>
  <div class="ring" style="width:820px;height:820px;right:-160px;top:-60px;opacity:.6"></div>
  <div class="logo"><img src="${LOGO}" alt="Edufy Academy"></div>
  <div class="copy">
    <div class="eyebrow"><i></i>${c.eyebrow}</div>
    <h1>${titleHtml(c.title)}</h1>
    <div class="line">${c.line}</div>
  </div>
  <div class="art">
    <div class="disc"></div>
    <div class="main">${icon(c.main, 210, '#FFFFFF')}</div>
    ${c.orbit.map((o, i) => `<div class="orb" style="left:${orbitPos[i][0]}%;top:${orbitPos[i][1]}%">${icon(o, 54, mid)}</div>`).join('')}
  </div>
  <div class="chips">${c.chips.map(([ic, label]) => `<div class="chip"><span class="i">${icon(ic, 24, mid)}</span>${label}</div>`).join('')}</div>
  </body></html>`;
}

(async () => {
  for (const c of COURSES) for (const n of [c.main, ...c.orbit, ...c.chips.map((x) => x[0])]) if (!Pi[n]) throw new Error('missing icon ' + n);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  for (const c of COURSES) {
    await p.setContent(page(c), { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    // Fit the title: every line on one row within the text column (max 76px, min 52px)
    await p.evaluate(() => {
      const h = document.querySelector('h1');
      let size = 76;
      const fits = () => [...h.querySelectorAll('.ln')].every((l) => l.scrollWidth <= 640);
      while (!fits() && size > 52) { size -= 2; h.style.fontSize = size + 'px'; }
    });
    const file = path.join(OUT, `${c.slug}.jpg`);
    await p.screenshot({ path: file, type: 'jpeg', quality: 86 });
    console.log(file, Math.round(fs.statSync(file).size / 1024) + ' KB');
  }
  await browser.close();
})();
