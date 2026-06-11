/* ===== TOAST ===== */
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ===== GNB 드롭다운 ===== */
function toggleSwitcher() {
  const btn = document.getElementById('switcherBtn');
  const profile = document.querySelector('.gnb-profile');
  btn.classList.toggle('open');
  profile.classList.remove('open');
}
function toggleProfile() {
  const profile = document.querySelector('.gnb-profile');
  const switcher = document.getElementById('switcherBtn');
  profile.classList.toggle('open');
  switcher.classList.remove('open');
}
document.addEventListener('click', (e) => {
  const switcher = document.getElementById('switcherBtn');
  const profile  = document.querySelector('.gnb-profile');
  if (switcher && !switcher.contains(e.target)) switcher.classList.remove('open');
  if (profile  && !profile.contains(e.target))  profile.classList.remove('open');
});

/* ===== 즐겨찾기 설정 모달 (번호 슬롯) ===== */
function openFavModal() {
  document.getElementById('favModal').classList.add('open');
  updateFavCount();
}
function closeFavModal(e) {
  if (e.target === document.getElementById('favModal'))
    document.getElementById('favModal').classList.remove('open');
}
function closeFavModalDirect() {
  document.getElementById('favModal').classList.remove('open');
}
function saveFav() {
  document.getElementById('favModal').classList.remove('open');
  showToast('역할 또는 권한 변경으로 즐겨찾기 메뉴 수정 적용되었습니다.');
}
function addFavSlot() {
  const slots = document.getElementById('favSlots');
  if (slots.children.length >= 5) { showToast('즐겨찾기는 최대 5개까지 설정할 수 있습니다.'); return; }
  const div = document.createElement('div');
  div.className = 'fav-slot';
  div.innerHTML =
    '<span class="fav-num"></span>' +
    '<select class="fav-select"><option>실시간 상담</option><option>AI 상담품질관리</option><option>상담 분석</option><option>지식 관리</option><option>캠페인 관리</option><option>통계 리포트</option></select>' +
    '<select class="fav-select placeholder"><option>메뉴 선택</option></select>' +
    '<button class="fav-del" onclick="removeFavSlot(this)">🗑</button>';
  slots.appendChild(div);
  renumberFavSlots();
}
function removeFavSlot(btn) {
  btn.closest('.fav-slot').remove();
  renumberFavSlots();
}
function renumberFavSlots() {
  [...document.querySelectorAll('#favSlots .fav-slot')].forEach((s, i) => {
    s.querySelector('.fav-num').textContent = i + 1;
  });
  updateFavCount();
}
function updateFavCount() {
  const n = document.querySelectorAll('#favSlots .fav-slot').length;
  const el = document.getElementById('favCount');
  if (el) el.textContent = `(${n}/5)`;
}

/* ===== AI 추천 카드 ===== */
function dismissReco(btn) { btn.closest('.reco-card').remove(); showToast('AI 추천을 닫았습니다.'); }
function addReco(btn, name) { btn.closest('.reco-card').remove(); showToast(`'${name}'을(를) 즐겨찾기에 추가했습니다.`); }

/* ===== AI 추천 넛지 닫기 ===== */
function rejectNudge() {
  document.getElementById('nudgeCard').style.display = 'none';
}

/* ===== 권한 안내 Modal (disabled 서비스) ===== */
function openPermModal(serviceName) {
  document.getElementById('permService').textContent = serviceName;
  document.getElementById('permModal').classList.add('open');
}
function closePermModal(e) {
  if (e.target === document.getElementById('permModal'))
    document.getElementById('permModal').classList.remove('open');
}
function closePermModalDirect() {
  document.getElementById('permModal').classList.remove('open');
}
function requestPerm() {
  const svc = document.getElementById('permService').textContent;
  document.getElementById('permModal').classList.remove('open');
  showToast(`'${svc}' 사용 권한을 관리자에게 요청했습니다.`);
}

/* ===== Skeleton Loading ===== */
function simulateSkeleton() {
  const targets = [...document.querySelectorAll('.bento-card, .pinned-card, .hero')];
  targets.forEach(el => el.classList.add('skeleton'));
  setTimeout(() => targets.forEach(el => el.classList.remove('skeleton')), 1200);
}

document.addEventListener('DOMContentLoaded', () => {
  simulateSkeleton();
});
