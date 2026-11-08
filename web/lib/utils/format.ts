/**
 * 날짜 및 금액 포맷터 유틸리티
 * 근거: docs/가이드/브랜드가이드라인.md, docs/화면기획서.md
 */

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    // ISO 형식 or 'YYYY-MM-DD HH:mm:ss'
    const cleanStr = dateStr.includes("T")
      ? dateStr
      : dateStr.replace(" ", "T");
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) {
      // 직접 파싱 fallback
      const parts = dateStr.split(" ");
      const datePart = parts[0] || "";
      const timePart = parts[1] || "";
      return `${datePart.replace(/-/g, ".")} ${timePart}`.trim();
    }
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dayOfWeek = days[d.getDay()];
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");

    return `${year}.${month}.${day} (${dayOfWeek}) ${hours}:${minutes}`;
  } catch {
    return dateStr || "";
  }
}

export function formatPrice(amount?: number | null): string {
  if (amount == null || isNaN(amount)) return "0원";
  return `${amount.toLocaleString("ko-KR")}원`;
}
