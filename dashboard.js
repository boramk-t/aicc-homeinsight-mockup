/* ===== TOAST ===== */
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ===== GNB 스위처 ===== */
function toggleSwitcher() { document.getElementById('switcherBtn').classList.toggle('open'); }
document.addEventListener('click', (e) => {
  const s = document.getElementById('switcherBtn');
  if (s && !s.contains(e.target)) s.classList.remove('open');
});

/* ===== 확인(Ack) 처리 + 포커스 알림 ===== */
const acknowledged = new Set();
let focusAlert = null; // 노드 클릭 시 하단에서 강조할 알림 id

/* ===== 부하 레벨 ===== */
function loadLevel(loadPct, delayed) {
  if (loadPct >= 200 || delayed) return 'crit';
  if (loadPct >= 150) return 'warn';
  return 'normal';
}
function levelKo(l){ return l==='crit'?'위험':l==='warn'?'주의':'정상'; }

/* ===== 상담 어드바이저 인프라 상태 (STT/LLM/미실행) ===== */
const infra = {
  stt: { key:'stt', name:'STT', full:'STT (음성→텍스트)', issue:'파드 이슈', icon:'🎙',
    level:'crit', cur:'4.2초', thr:'3초', metric:'평균 STT 응답', duration:'4분째 지속', trend:'악화 ▲',
    impact:'진행 중 상담 약 86건 음성 인식 지연', cause:'STT 파드 1개 비정상 종료(OOM) 추정',
    action:'STT 파드 재기동 / 리소스 증설 검토', owner:'스피치 기술팀' },
  llm: { key:'llm', name:'LLM', full:'LLM (지식추천·요약·코드추천)', issue:'LLM 이슈', icon:'🤖',
    level:'normal', cur:'1.8초', thr:'3초', metric:'평균 LLM 응답', duration:'-', trend:'정상 ─',
    impact:'-', cause:'-', action:'-', owner:'LLM기술팀' },
  cpu: { key:'cpu', name:'미실행', full:'상담 어드바이저 미실행', issue:'CPU 이슈', icon:'🖥',
    level:'normal', cur:'CPU 61%', thr:'80%', metric:'어드바이저 노드 CPU', duration:'-', trend:'정상 ─',
    impact:'-', cause:'-', action:'-', owner:'AICC assistant팀' },
};
// 어드바이저 종합 레벨 = 가장 심각한 인프라
function advisorLevel() {
  const lv = Object.values(infra).map(x=>x.level);
  if (lv.includes('crit')) return 'crit';
  if (lv.includes('warn')) return 'warn';
  return 'normal';
}
function advisorIssues() {
  return Object.values(infra).filter(x=>x.level!=='normal').map(x=>x.name); // ['STT','LLM',...]
}

/* ===== 여정 단계 데이터 ===== */
// 진입 세부
const entryChannels = [
  { name:'ARS', detail:'보이는 38% / 음성 62%', share:42 },
  { name:'챗봇 직링크', detail:'', share:31 },
  { name:'상담사 직통', detail:'', share:18 },
  { name:'채팅상담 직링크', detail:'', share:9 },
];
// 연결 대기 채널
const waitChannels = [ { name:'홈 채널', share:0 }, { name:'모바일 채널', share:0 } ];

const stages = {
  enter:   { id:'S1', name:'진입', baseline:320 },
  callbot: { id:'S2', name:'콜봇', baseline:150, special:'특정 콜(요금조회) 집중' },
  chatbot: { id:'S2', name:'챗봇', baseline:130, special:"'명의변경' 시나리오 대기" },
  botres:  { id:'S3', name:'봇 결과', baseline:210 },
  wait:    { id:'S4', name:'연결 대기', baseline:120 },
  advisor: { id:'S5', name:'상담 어드바이저', baseline:160 },
  autoqa:  { id:'S6', name:'AutoQA', baseline:140 },
};

function tick() {
  Object.values(stages).forEach(s => { s.delayed=false; let mult=0.9+Math.random()*0.25;
    if (s===stages.callbot){ mult=1.5+Math.random()*0.15; }  // 콜봇: 일부 주의 (150~165%)
    if (s===stages.chatbot){ mult=0.85+Math.random()*0.25; } // 챗봇: 정상
    if (s===stages.wait){ mult=0.9+Math.random()*0.3; }      // 연결 대기: 정상
    s.now=Math.round(s.baseline*mult); s.loadPct=Math.round(s.now/s.baseline*100);
    s.level = loadLevel(s.loadPct, s.delayed);
  });
  // 어드바이저 레벨은 인프라 기반 (STT 위험만)
  stages.advisor.level = advisorLevel();
  // 연결 대기 채널 분배 (모바일에 더 몰림)
  const w = stages.wait.now;
  waitChannels[0].share = Math.round(w*0.42); // 홈
  waitChannels[1].share = w - waitChannels[0].share; // 모바일
}

/* ===== 여정 흐름 렌더 ===== */
/* ===== 예측 레인 (Measurement vs Predictive) ===== */
let horizon = 10; // 예측 시점(분)
const forecastMetrics = [
  { key:'inflow', name:'전체 인입', unit:'건/분', base:()=>Object.values(stages).reduce((a,s)=>a+s.now,0), perMin:6.5, thr:2600 },
  { key:'wait',   name:'상담 대기', unit:'명',    base:()=>stages.wait.now,  perMin:3.2, thr:80 },
  { key:'ars',    name:'ARS 인입',  unit:'건/분', base:()=>Math.round(stages.enter.now*0.42), perMin:4.1, thr:180 },
  { key:'callbot',name:'콜봇 부하',  unit:'%',     base:()=>stages.callbot.loadPct, perMin:1.6, thr:200 },
];
function forecastLevel(val, thr){ if(val>=thr) return 'crit'; if(val>=thr*0.85) return 'warn'; return 'normal'; }
function renderForecast() {
  const grid = document.getElementById('forecastGrid');
  grid.innerHTML = forecastMetrics.map(m => {
    const now = m.base();
    const pred = Math.round(now + m.perMin * horizon);
    const nowLv = forecastLevel(now, m.thr);
    const predLv = forecastLevel(pred, m.thr);
    const deltaPct = Math.round((pred-now)/Math.max(now,1)*100);
    const willBreach = predLv==='crit' && nowLv!=='crit';
    return `
      <div class="fc-card ${predLv}">
        <div class="fc-name">${m.name}</div>
        <div class="fc-compare">
          <div class="fc-col">
            <div class="fc-tag now">실시간</div>
            <div class="fc-val ${nowLv}">${now.toLocaleString()}<span class="fc-unit">${m.unit}</span></div>
          </div>
          <div class="fc-arrow">→</div>
          <div class="fc-col">
            <div class="fc-tag pred">🔮 +${horizon}분</div>
            <div class="fc-val ${predLv}">${pred.toLocaleString()}<span class="fc-unit">${m.unit}</span></div>
          </div>
        </div>
        <div class="fc-foot">
          <span class="fc-delta ${deltaPct>=0?'up':'down'}">${deltaPct>=0?'▲':'▼'} ${Math.abs(deltaPct)}%</span>
          ${willBreach ? `<span class="fc-breach">⚠ ${horizon}분 뒤 임계(${m.thr.toLocaleString()}) 초과 예상</span>`
            : `<span class="fc-ok">임계 ${m.thr.toLocaleString()} 이내</span>`}
        </div>
      </div>`;
  }).join('');

  const recos = [];
  const waitNow = stages.wait.now, waitPred = Math.round(waitNow + 3.2*horizon);
  if (waitPred >= 80) {
    const need = Math.ceil((waitPred-60)/10);
    recos.push(`🧑‍💼 <b>${horizon}분 뒤 상담 대기 ${waitPred}명 예상</b> (현재 ${waitNow}명) → 상담사 <b>${need}명</b> 추가 투입을 권장합니다.`);
  }
  const arsNow = Math.round(stages.enter.now*0.42), arsPred = Math.round(arsNow + 4.1*horizon);
  if (arsPred >= 180) {
    recos.push(`📞 <b>ARS 인입 증가 추세</b> — ${horizon}분 뒤 콜 적체로 상담 연결 지연이 예상됩니다. 콜봇 우회 안내·인력 사전 배치를 검토하세요.`);
  }
  if (stages.callbot.loadPct + 1.6*horizon >= 200) {
    recos.push(`🤖 <b>콜봇 부하 상승 추세</b> — ${horizon}분 뒤 위험 수준 도달 가능. 특정 콜(요금조회) 집중 여부를 점검하세요.`);
  }
  document.getElementById('forecastReco').innerHTML = recos.length
    ? `<div class="fc-reco-title">🔮 예측 기반 권장 조치</div>` + recos.map(r=>`<div class="fc-reco-item">${r}</div>`).join('')
    : `<div class="fc-reco-ok">예측 범위 내 임계 초과가 예상되지 않습니다 ✅</div>`;
}
function initHorizonSeg() {
  const seg = document.getElementById('horizonSeg');
  seg.querySelectorAll('.seg-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      seg.querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      horizon = parseInt(btn.dataset.h,10);
      renderForecast();
      showToast(`예측 시점을 +${horizon}분으로 변경했어요.`);
    });
  });
}

/* ===== 노드 상태 표시 통일 =====
   정상: ● 정상 / 부하: ▲ 부하 N% / 이슈: ⚠ {이슈명} 이슈 */
function statusNormal(){ return `<div class="df-status normal"><span class="df-st-ico">●</span> 정상</div>`; }
function statusLoad(s){
  const w = Math.min(s.loadPct,220)/220*100;
  return `<div class="df-status ${s.level}"><span class="df-st-ico">▲</span> 부하 ${s.loadPct}% · ${levelKo(s.level)}</div>
    <div class="df-loadbar"><div class="df-loadbar-fill ${s.level}" style="width:${w}%"></div></div>`;
}
function statusIssue(level, text){
  return `<div class="df-status ${level}"><span class="df-st-ico">⚠</span> ${text}</div>`;
}
function loadOrNormal(s){ return s.level==='normal' ? statusNormal() : statusLoad(s); }
function arrow(){ return '<div class="df-arrow">→</div>'; }

function renderFlow() {
  const e = stages.enter;
  // 진입(상세 채널 리스트)
  const enterNode = `
    <div class="df-stage">
      <div class="df-node ${e.level}" onclick="showToast('진입 채널 상세로 이동합니다.')">
        <div class="df-node-head"><span class="df-id">${e.id}</span><span class="df-name">진입</span></div>
        <div class="df-now">${e.now}<span class="df-now-unit"> 건/분</span></div>
        <div class="df-entry-list">
          ${entryChannels.map(c=>`<div class="df-entry"><span>${c.name}</span><b>${c.share}%</b>${c.detail?`<small>${c.detail}</small>`:''}</div>`).join('')}
        </div>
      </div>${arrow()}
    </div>`;

  // 봇(콜봇/챗봇 세로 분리) — 한 stage 안에 위아래
  const cb = stages.callbot, ch = stages.chatbot;
  const botNode = `
    <div class="df-stage">
      <div class="df-botwrap">
        <div class="df-node bot ${cb.level}" onclick="showToast('콜봇 상세로 이동합니다.')">
          <div class="df-node-head"><span class="df-id">S2</span><span class="df-name">📞 콜봇</span></div>
          <div class="df-now sm">${cb.now}<span class="df-now-unit"> 건/분</span></div>
          ${loadOrNormal(cb)}
          ${cb.level!=='normal'?`<div class="df-special">⚠ ${cb.special}</div>`:''}
        </div>
        <div class="df-node bot ${ch.level}" onclick="showToast('챗봇 상세로 이동합니다.')">
          <div class="df-node-head"><span class="df-id">S2</span><span class="df-name">💬 챗봇</span></div>
          <div class="df-now sm">${ch.now}<span class="df-now-unit"> 건/분</span></div>
          ${loadOrNormal(ch)}
          ${ch.level!=='normal'?`<div class="df-special">⚠ ${ch.special}</div>`:''}
        </div>
      </div>${arrow()}
    </div>`;

  // 봇 결과
  const br = stages.botres;
  const botresNode = `
    <div class="df-stage">
      <div class="df-node ${br.level}" onclick="showToast('봇 결과 상세로 이동합니다.')">
        <div class="df-node-head"><span class="df-id">${br.id}</span><span class="df-name">봇 결과</span></div>
        <div class="df-now">${br.now}<span class="df-now-unit"> 건/분</span></div>
        ${loadOrNormal(br)}
      </div>${arrow()}
    </div>`;

  // 연결 대기(홈/모바일 분리)
  const wt = stages.wait;
  const homeShare = Math.round(waitChannels[0].share/wt.now*100)||0;
  const mobShare = 100-homeShare;
  const waitNode = `
    <div class="df-stage">
      <div class="df-node ${wt.level}" onclick="showToast('연결 대기 상세로 이동합니다.')">
        ${wt.delayed?'<span class="df-delay">응답 지연</span>':''}
        <div class="df-node-head"><span class="df-id">${wt.id}</span><span class="df-name">연결 대기</span></div>
        <div class="df-now">${wt.now}<span class="df-now-unit"> 명 대기</span></div>
        ${loadOrNormal(wt)}
        <div class="df-channel">
          <div class="df-ch-row"><span>🏠 홈</span><div class="df-ch-bar"><div style="width:${homeShare}%"></div></div><b>${waitChannels[0].share}</b></div>
          <div class="df-ch-row hot"><span>📱 모바일</span><div class="df-ch-bar"><div class="hot" style="width:${mobShare}%"></div></div><b>${waitChannels[1].share}</b></div>
        </div>
      </div>${arrow()}
    </div>`;

  // 상담 어드바이저 (STT/LLM/미실행 상태)
  const ad = stages.advisor;
  const issues = advisorIssues();
  const adInner = ad.level==='normal'
    ? statusNormal()
    : statusIssue(ad.level, `${issues.join(' · ')} 이슈`) + `
       <div class="df-infra-mini">
         ${Object.values(infra).map(x=>`<span class="infra-chip ${x.level}" onclick="event.stopPropagation();focusInfra('${x.key}')">${x.name} ${x.level==='normal'?'정상':levelKo(x.level)}</span>`).join('')}
       </div>`;
  const advisorNode = `
    <div class="df-stage">
      <div class="df-node ${ad.level}" onclick="focusAdvisor()">
        <div class="df-node-head"><span class="df-id">${ad.id}</span><span class="df-name">상담 어드바이저</span></div>
        <div class="df-now">${ad.now}<span class="df-now-unit"> 건/분</span></div>
        ${adInner}
      </div>${arrow()}
    </div>`;

  // AutoQA
  const qa = stages.autoqa;
  const qaNode = `
    <div class="df-stage">
      <div class="df-node ${qa.level}" onclick="showToast('AutoQA 상세로 이동합니다.')">
        <div class="df-node-head"><span class="df-id">${qa.id}</span><span class="df-name">AutoQA</span></div>
        <div class="df-now">${qa.now}<span class="df-now-unit"> 건/분</span></div>
        ${loadOrNormal(qa)}
      </div>
    </div>`;

  document.getElementById('dashFlow').innerHTML =
    enterNode + botNode + botresNode + waitNode + advisorNode + qaNode;
}

/* ===== 노드 클릭 → 하단 알림 강조 ===== */
function focusInfra(key){ focusAlert = 'infra-'+key; renderWatch(); scrollToWatch(); }
function focusAdvisor(){
  const first = Object.values(infra).find(x=>x.level!=='normal');
  focusAlert = first ? 'infra-'+first.key : null;
  renderWatch(); scrollToWatch();
}
function scrollToWatch(){ document.querySelector('.watch-panel').scrollIntoView({behavior:'smooth', block:'center'}); }

/* ===== 시스템 상태 신호등 ===== */
function stageLabel(s){
  // 어드바이저는 어떤 인프라 이슈인지까지
  if (s===stages.advisor) return `상담 어드바이저(${advisorIssues().join('·')})`;
  if (s===stages.callbot) return '콜봇';
  if (s===stages.chatbot) return '챗봇';
  return s.name;
}
function renderStatus() {
  const all = [...Object.values(stages)];
  const critList = all.filter(s=>s.level==='crit').map(stageLabel);
  const warnList = all.filter(s=>s.level==='warn').map(stageLabel);
  const banner = document.getElementById('statusBanner');
  let cls,title,sub;
  if (critList.length>0){ cls='crit'; title=`위험 — ${critList.join(', ')}`; sub=`즉시 확인이 필요한 구간: ${critList.join(', ')}${warnList.length?` · 주의: ${warnList.join(', ')}`:''}`; }
  else if (warnList.length>0){ cls='warn'; title=`주의 — ${warnList.join(', ')}`; sub=`부하가 높아지는 구간: ${warnList.join(', ')}`; }
  else { cls='ok'; title='시스템 정상 운영 중'; sub='모든 서비스가 정상 범위에서 동작하고 있습니다.'; }
  banner.className='status-banner '+cls;
  document.getElementById('sbTitle').textContent=title;
  document.getElementById('sbSub').textContent=sub;
  const totalNow = Object.values(stages).reduce((a,s)=>a+s.now,0);
  document.getElementById('sbMetrics').innerHTML = `
    <div class="sb-metric"><div class="sb-metric-val">${totalNow.toLocaleString()}</div><div class="sb-metric-label">현재 처리량(건/분)</div></div>
    <div class="sb-metric"><div class="sb-metric-val">${stages.wait.now}</div><div class="sb-metric-label">상담 대기(명)</div></div>
    <div class="sb-metric"><div class="sb-metric-val">0분 51초</div><div class="sb-metric-label">평균 대기시간</div></div>`;
}

/* ===== 실시간 이상 알림 (여정 + 인프라 통합) ===== */
function buildAlerts() {
  const list = [];
  // 인프라 알림
  Object.values(infra).forEach(x=>{
    if (x.level==='normal') return;
    list.push({ id:'infra-'+x.key, type:x.level, icon:x.icon,
      title:`상담 어드바이저 · ${x.full} (${x.issue})`,
      cur:`${x.cur} / 임계 ${x.thr}`, trend:x.trend, duration:x.duration,
      impact:x.impact, cause:x.cause, action:x.action, owner:x.owner });
  });
  // 봇/대기 알림
  if (stages.callbot.level!=='normal') list.push({ id:'al-callbot', type:stages.callbot.level, icon:'📞',
    title:`콜봇 부하 ${stages.callbot.loadPct}% (${levelKo(stages.callbot.level)})`,
    cur:`${stages.callbot.loadPct}% / 임계 150%`, trend:'정체 ─', duration:'3분째 지속',
    impact:`콜봇 응대 약 ${Math.round(stages.callbot.now*0.4)}건 대기`,
    cause:'특정 콜(요금조회)로 인입이 일시 집중되고 있습니다.', action:'콜봇 시나리오 점검 / 리소스 확인', owner:'상담봇 스쿼드' });
  if (stages.chatbot.level!=='normal') list.push({ id:'al-chatbot', type:stages.chatbot.level, icon:'💬',
    title:`챗봇 부하 ${stages.chatbot.loadPct}% (${levelKo(stages.chatbot.level)})`,
    cur:`${stages.chatbot.loadPct}% / 임계 150%`, trend:'정체 ─', duration:'-',
    impact:`챗봇 응대 일부 대기`,
    cause:'특정 시나리오에서 응답이 튀고 있습니다.', action:'해당 시나리오 분기/연동 점검', owner:'상담봇 스쿼드' });
  if (stages.wait.level!=='normal') list.push({ id:'al-wait', type:stages.wait.level, icon:'⏱',
    title:`상담사 연결 대기 (${levelKo(stages.wait.level)})`,
    cur:`${stages.wait.loadPct}% / 임계 150%`, trend:'정체 ─', duration:'-',
    impact:`대기 ${stages.wait.now}명 · 모바일 채널 집중`,
    cause:'모바일 채널 인입이 상대적으로 많습니다.', action:'채널별 인입 모니터링', owner:'상담 운영팀' });
  return list;
}
function renderWatch() {
  const alerts = buildAlerts().filter(a=>!acknowledged.has(a.id));
  document.getElementById('watchCount').textContent = `${alerts.length}건`;
  document.getElementById('alertBadge').textContent = alerts.length;
  // 포커스된 알림을 맨 위로
  alerts.sort((a,b)=> (b.id===focusAlert?1:0)-(a.id===focusAlert?1:0));
  document.getElementById('watchList').innerHTML = alerts.length ? alerts.map(a=>`
    <div class="watch-card ${a.type} ${a.id===focusAlert?'focused':''}">
      <span class="watch-icon">${a.icon}</span>
      <div class="watch-body">
        <div class="watch-title">${a.title} <span class="watch-trend ${a.trend.includes('악화')?'bad':''}">${a.trend}</span></div>
        <div class="watch-metricline">📊 ${a.cur} · ${a.duration}</div>
        <div class="watch-meta">영향: ${a.impact}</div>
        <div class="watch-desc">원인: ${a.cause}</div>
        <div class="watch-action">권장 조치: ${a.action}</div>
        <div class="watch-foot">
          <span class="watch-owner">담당 ${a.owner}</span>
          <div class="infra-btns">
            <button class="infra-btn" onclick="ackItem('${a.id}','${a.title}')">확인</button>
            <button class="infra-btn esc" onclick="escItem('${a.title}','${a.owner}')">에스컬레이션</button>
          </div>
        </div>
      </div>
    </div>`).join('') : '<div class="watch-empty">현재 미확인 이상 알림이 없습니다 ✅</div>';
}
function ackItem(id,name){ acknowledged.add(id); if(focusAlert===id) focusAlert=null; showToast(`'${name}' 알림을 확인 처리했습니다.`); renderWatch(); }
function escItem(name,owner){ showToast(`'${name}' 건을 ${owner}에 에스컬레이션했습니다.`); }

/* ===== 종료 비율 (경로별 × 종료유형) ===== */
const endByPath = [
  { path:'ARS',    resolved:64, drop:28, transfer:8 },
  { path:'봇',     resolved:71, drop:22, transfer:7 },
  { path:'상담사', resolved:82, drop:6,  transfer:12 },
];
function renderEnd() {
  document.getElementById('endBars').innerHTML = endByPath.map(p=>`
    <div class="endp-row">
      <span class="endp-label">${p.path}</span>
      <div class="endp-track">
        <div class="endp-seg ok" style="width:${p.resolved}%">${p.resolved}%</div>
        <div class="endp-seg drop" style="width:${p.drop}%">${p.drop}%</div>
        <div class="endp-seg warn" style="width:${p.transfer}%">${p.transfer}%</div>
      </div>
    </div>`).join('') + `
    <div class="endp-legend">
      <span class="ml-item"><i class="ml-dot ok"></i> 해결 종료</span>
      <span class="ml-item"><i class="ml-dot drop"></i> 미해결 이탈</span>
      <span class="ml-item"><i class="ml-dot warn"></i> 호이관</span>
    </div>`;
}

/* ===== AutoQA 게이지 ===== */
function gauge(elId,value){
  const c=Math.PI*72, offset=c*(1-value/100);
  const color=value>=80?'#10b981':value>=60?'#f59e0b':'#ef4444';
  document.getElementById(elId).innerHTML=`
    <svg class="gauge-svg" viewBox="0 0 160 160">
      <path class="gauge-track" d="M8,80 A72,72 0 0 1 152,80" />
      <path class="gauge-fill" d="M8,80 A72,72 0 0 1 152,80" stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${offset}" />
    </svg><div class="gauge-num" style="color:${color}">${value}</div>`;
}
function renderQuality(){ gauge('qaGauge', 84+Math.round((Math.random()-0.5)*3)); }

/* ===== 시계 ===== */
function renderClock(){
  const now=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  document.getElementById('liveClock').textContent=`🕒 ${now} 기준 (실시간)`;
}

/* ===== 갱신 ===== */
function refresh(){ tick(); renderFlow(); renderStatus(); renderForecast(); renderWatch(); renderClock(); }

document.addEventListener('DOMContentLoaded', ()=>{
  initHorizonSeg();
  refresh(); renderEnd(); renderQuality(); renderClock();
  setInterval(renderClock,1000);
  setInterval(refresh,4000);
  setInterval(renderQuality,8000);
});
