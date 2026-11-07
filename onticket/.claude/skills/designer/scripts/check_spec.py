"""화면기획서가 PRD 범위 안에 있고 빠짐없는지, 형식과 문구 규칙을 지켰는지 검사한다.

사용: python3 -I .claude/skills/designer/scripts/check_spec.py docs/화면기획서.md docs/PRD.md [템플릿]
템플릿을 주지 않으면 docs/templates/화면기획서-템플릿.md가 있을 때 그것을, 없으면 스킬의 기본 형식을 쓴다.

검사 항목
 1. 절(##) 제목이 형식과 같다
 2. 화면기획서가 참조한 R·AC가 PRD 3절·4절에 있다
 3. PRD 5절 범위 제외 R을 참조하지 않는다
 4. PRD 3절의 R이 모두 1절 화면 목록에 나온다
 5. PRD 4절의 AC가 모두 어느 상태 표에 나온다
 6. 화면 ID(S01…)가 1절 목록과 3절 상세에서 일치한다
 7. {자리표시}, HEX 색, px 값(기준 폭 줄 제외), 금지 표현, 느낌표가 없다
"""
import re
import sys
from pathlib import Path

DEFAULT_HEADINGS = ["1. 화면 목록", "2. 화면 흐름", "3. 화면 상세", "4. 공통 규칙", "5. 결정·미결"]
BANNED = ["지금 바로", "놓치지 마세요", "최고의", "완벽한", "축하합니다", "서두르세요"]
SEP = re.compile(r"^\|\s*:?-{3,}")


def section(text: str, num: str) -> str:
    m = re.search(rf"^## {re.escape(num)}\..*?$(.*?)(?=^## |\Z)", text, re.S | re.M)
    return m.group(1) if m else ""


def table_rows(block: str):
    lines, out, i = block.splitlines(), [], 0
    while i < len(lines):
        if lines[i].startswith("|") and i + 1 < len(lines) and SEP.match(lines[i + 1]):
            head = [c.strip() for c in lines[i].strip().strip("|").split("|")]
            i += 2
            while i < len(lines) and lines[i].startswith("|"):
                out.append(dict(zip(head, [c.strip() for c in lines[i].strip().strip("|").split("|")])))
                i += 1
            continue
        i += 1
    return out


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    spec = Path(sys.argv[1]).read_text(encoding="utf-8")
    prd = Path(sys.argv[2]).read_text(encoding="utf-8")
    tpl_path = Path(sys.argv[3]) if len(sys.argv) > 3 else Path("docs/templates/화면기획서-템플릿.md")
    errs: list[str] = []

    # 1. 절
    want = [h.strip() for h in re.findall(r"^## (.*)$", tpl_path.read_text(encoding="utf-8"), re.M)] if tpl_path.exists() else DEFAULT_HEADINGS
    got = [h.strip() for h in re.findall(r"^## (.*)$", spec, re.M)]
    if got != want:
        errs.append(f"[절] {got} ≠ 형식 {want}")

    # PRD에서 R·AC·범위 제외
    prd_r = {r.get("ID") for r in table_rows(section(prd, "3")) if r.get("ID")}
    prd_ac = {r.get("ID") for r in table_rows(section(prd, "4")) if r.get("ID")}
    excluded = set(re.findall(r"\bR\d+\b", section(prd, "5")))
    excluded -= prd_r  # 5절 대체 수단 칸이 남은 요구를 가리키는 것은 제외가 아니다
    excluded_rows = {r for row in table_rows(section(prd, "5")) for r in re.findall(r"\bR\d+\b", row.get("항목", ""))}

    # 2·3. 참조
    for rid in sorted(set(re.findall(r"\bR\d+\b", spec)), key=lambda x: int(x[1:])):
        if rid in excluded_rows:
            errs.append(f"[범위] {rid}는 PRD 5절 범위 제외다")
        elif rid not in prd_r:
            errs.append(f"[참조] {rid}가 PRD 3절에 없다")
    for ac in sorted(set(re.findall(r"\bAC\d+\b", spec)), key=lambda x: int(x[2:])):
        if ac not in prd_ac:
            errs.append(f"[참조] {ac}가 PRD 4절에 없다")

    # 4. R 빠짐 (1절 화면 목록 기준)
    listed = set(re.findall(r"\bR\d+\b", section(spec, "1")))
    for rid in sorted(prd_r - listed, key=lambda x: int(x[1:])):
        errs.append(f"[빠짐] PRD {rid}가 1절 화면 목록 어디에도 없다")

    # 5. AC 빠짐 (3절 상태 표의 '관련 AC' 열 기준)
    s3 = section(spec, "3")
    state_ac = {a for row in table_rows(s3) for a in re.findall(r"\bAC\d+\b", row.get("관련 AC", ""))}
    for ac in sorted(prd_ac - state_ac, key=lambda x: int(x[2:])):
        errs.append(f"[빠짐] PRD {ac}가 3절 어느 상태 표의 '관련 AC'에도 없다")

    # 6. 화면 ID 일치
    list_ids = {r.get("ID") for r in table_rows(section(spec, "1")) if r.get("ID")}
    detail_ids = set(re.findall(r"^### (S\d+)\b", s3, re.M))
    for s in sorted(list_ids - detail_ids):
        errs.append(f"[화면] {s}가 1절에는 있고 3절 상세가 없다")
    for s in sorted(detail_ids - list_ids):
        errs.append(f"[화면] {s}가 3절 상세에는 있고 1절 목록에 없다")

    # 7. 자리표시·수치·문구
    for n, line in enumerate(spec.splitlines(), 1):
        s = line.strip()
        if re.search(r"\{[^}]*\}", s):
            errs.append(f"[자리표시] {n}행: {s[:60]}")
        if re.search(r"#[0-9A-Fa-f]{3,8}\b", s):
            errs.append(f"[수치] {n}행에 HEX 색이 있다 — 역할 이름으로 쓴다")
        if re.search(r"\b\d+px\b", s) and "기준 폭" not in s:
            errs.append(f"[수치] {n}행에 px 값이 있다 — 토큰이 정한다")
        for b in BANNED:
            if b in s:
                errs.append(f"[문구] {n}행에 금지 표현 '{b}'")
    for row in table_rows(s3):
        if "문구" in row and "!" in row["문구"]:
            errs.append(f"[문구] {row.get('문구 ID')}에 느낌표가 있다")

    if errs:
        print(f"위반 {len(errs)}건")
        for e in errs:
            print(" -", e)
        sys.exit(1)
    print(f"OK — 화면 {len(list_ids)}개, PRD R {len(prd_r)}개·AC {len(prd_ac)}개 모두 반영")


if __name__ == "__main__":
    main()
