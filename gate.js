/* ===== 비밀번호 게이트 (JS 해시 방식) =====
   - SHA-256 해시 비교로 접근 제어
   - 정적 사이트용 간이 보호 (소스 노출 시 우회 가능)
*/
(function () {
  // 게이트 비활성화 토글: true 면 암호창 없이 통과 (로컬 확인용)
  // 다시 보호하려면 false 로 변경.
  const GATE_DISABLED = true;
  if (GATE_DISABLED) return;

  const PASS_HASH = "2ad92a7ebf814925a4331f4702d9b0536418070c1e498152e46bc016526ef63d"; // AICC26
  const PASS_PLAIN = "AICC26"; // file:// 등 crypto.subtle 미지원 환경 폴백
  const SESSION_KEY = "aicc_gate_ok";

  // 이미 인증된 세션이면 통과
  if (sessionStorage.getItem(SESSION_KEY) === "1") return;

  // 게이트 전용 스타일 주입 (페이지 CSS와 무관하게 항상 중앙 정렬 보장)
  const gateStyle = document.createElement("style");
  gateStyle.id = "gate-style";
  gateStyle.textContent = `
    #gate-overlay {
      position: fixed; inset: 0; z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #F472B6 0%, #DB2777 100%);
    }
    #gate-overlay .gate-card {
      background: #fff; border-radius: 20px; padding: 40px 36px;
      width: 360px; max-width: 90vw; text-align: center;
      box-shadow: 0 24px 64px rgba(0,0,0,0.25);
      font-family: 'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif;
    }
    #gate-overlay .gate-logo { margin-bottom: 18px; }
    #gate-overlay .gate-uplus { font-size: 24px; font-weight: 900; color: #E6007E; }
    #gate-overlay .gate-title { font-size: 20px; font-weight: 700; color: #111827; margin-left: 3px; }
    #gate-overlay .gate-desc { font-size: 13px; color: #4B5563; margin-bottom: 24px; }
    #gate-overlay #gate-form { display: flex; flex-direction: column; gap: 10px; }
    #gate-overlay #gate-input { width: 100%; padding: 12px 14px; font-size: 14px; border: 1px solid #E4E7F0; border-radius: 10px; outline: none; }
    #gate-overlay #gate-input:focus { border-color: #E6007E; }
    #gate-overlay #gate-form button { width: 100%; padding: 12px; font-size: 14px; font-weight: 600; background: #E6007E; color: #fff; border: none; border-radius: 10px; cursor: pointer; }
    #gate-overlay #gate-form button:hover { background: #C2006A; }
    #gate-overlay .gate-error { font-size: 12px; color: #EF4444; margin-top: 12px; min-height: 16px; }
  `;
  document.documentElement.appendChild(gateStyle);

  // 본문 숨김
  const style = document.createElement("style");
  style.id = "gate-hide-style";
  style.textContent = "body > *:not(#gate-overlay){filter:blur(8px);pointer-events:none;user-select:none;}";
  document.documentElement.appendChild(style);

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // crypto.subtle은 보안 컨텍스트(https/localhost)에서만 동작.
  // file:// 로 직접 열면 미지원 → 평문 비교로 폴백.
  async function checkPass(value) {
    const hasSubtle = (typeof crypto !== "undefined") && crypto.subtle;
    if (hasSubtle) {
      try {
        return (await sha256(value)) === PASS_HASH;
      } catch (e) {
        /* file:// 등에서 digest 실패 시 폴백 */
      }
    }
    return value === PASS_PLAIN;
  }

  function buildGate() {
    const overlay = document.createElement("div");
    overlay.id = "gate-overlay";
    overlay.innerHTML = `
      <div class="gate-card">
        <div class="gate-logo"><span class="gate-uplus">U+</span><span class="gate-title">AICC Console</span></div>
        <p class="gate-desc">이 페이지는 비밀번호로 보호되어 있습니다.</p>
        <form id="gate-form">
          <input id="gate-input" type="password" placeholder="비밀번호를 입력하세요" autocomplete="off" autofocus />
          <button type="submit">입장</button>
        </form>
        <p class="gate-error" id="gate-error"></p>
      </div>`;
    document.body.appendChild(overlay);

    const form = overlay.querySelector("#gate-form");
    const input = overlay.querySelector("#gate-input");
    const err = overlay.querySelector("#gate-error");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (await checkPass(input.value)) {
        sessionStorage.setItem(SESSION_KEY, "1");
        overlay.remove();
        const s = document.getElementById("gate-hide-style");
        if (s) s.remove();
      } else {
        err.textContent = "비밀번호가 올바르지 않습니다.";
        input.value = "";
        input.focus();
      }
    });
  }

  if (document.body) buildGate();
  else document.addEventListener("DOMContentLoaded", buildGate);
})();
