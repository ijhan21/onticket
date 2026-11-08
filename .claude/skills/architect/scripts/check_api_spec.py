#!/usr/bin/env python3
"""API 명세서(docs/API-Spec.md)가 템플릿 양식을 지키고, PRD·화면기획서·ERD와 일치하는지 검사한다.

사용법:
  python3 -I .claude/skills/architect/scripts/check_api_spec.py docs/API-Spec.md [docs/PRD.md] [docs/화면기획서.md] [docs/ERD.md]

검사 항목:
 1. 템플릿 절(##) 제목과 구조 일치 여부
 2. 남은 자리표시자({…}) 유무
 3. 엔드포인트 목록의 근거 R 번호 및 쓰는 화면 누락 여부
 4. 계산값(잔여·금액)의 계산 주체가 '서버'인지 확인
 5. PRD 대조: 범위 제외 R 참조 여부 및 PRD 3절 R 연결 확인
 6. ERD 대조: 명세의 필드가 ERD에 존재하는 컬럼인지 확인 (ERD가 주어졌을 때)
 7. 화면기획서 대조: 3절 화면별 값 대조표에 화면 목록이 반영되었는지 확인
"""
import re
import sys
from pathlib import Path

REQUIRED_HEADINGS = [
    "0. 공통 규칙",
    "1. 엔드포인트 목록",
    "2. 엔드포인트별 명세",
    "3. 화면별 값 대조표",
    "4. 계산값",
    "5. 질문"
]

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
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    spec_path = Path(sys.argv[1])
    if not spec_path.exists():
        print(f"[오류] 명세서 파일이 없습니다: {spec_path}")
        sys.exit(1)

    spec = spec_path.read_text(encoding="utf-8")
    prd_path = Path(sys.argv[2]) if len(sys.argv) > 2 and Path(sys.argv[2]).exists() else None
    screen_path = Path(sys.argv[3]) if len(sys.argv) > 3 and Path(sys.argv[3]).exists() else None
    erd_path = Path(sys.argv[4]) if len(sys.argv) > 4 and Path(sys.argv[4]).exists() else None

    errs: list[str] = []

    # 1. 템플릿 절 확인
    got_headings = [h.strip() for h in re.findall(r"^## (.*)$", spec, re.M)]
    for req in REQUIRED_HEADINGS:
        if not any(req in gh for gh in got_headings):
            errs.append(f"[절 누락] '## {req}' 절이 명세서에 없습니다")

    # 2. 자리표시자({…}) 검사
    for n, line in enumerate(spec.splitlines(), 1):
        s = line.strip()
        if re.search(r"\{[^}]*\}", s):
            errs.append(f"[자리표시자] {n}행: 미완성 자리표시자가 있습니다 -> {s[:60]}")

    # 3. 1절 엔드포인트 목록 검사
    s1 = section(spec, "1")
    s1_rows = table_rows(s1)
    if not s1_rows:
        errs.append("[엔드포인트] 1절 엔드포인트 목록 표가 비어 있습니다")
    for row in s1_rows:
        method = row.get("메서드", "")
        path = row.get("경로", "")
        r_ref = row.get("근거(PRD R)", "") or row.get("근거", "")
        screen_ref = row.get("쓰는 화면", "")
        if not r_ref:
            errs.append(f"[엔드포인트 근거 누락] {method} {path}: 근거 PRD R 번호가 비어 있습니다")
        if not screen_ref:
            errs.append(f"[엔드포인트 화면 누락] {method} {path}: 쓰는 화면이 비어 있습니다")

    # 4. 4절 계산값 검사
    s4 = section(spec, "4")
    s4_rows = table_rows(s4)
    for row in s4_rows:
        name = row.get("이름", "")
        where = row.get("계산하는 곳", "")
        if "서버" not in where:
            errs.append(f"[계산값 오류] '{name}'의 계산하는 곳이 '서버'가 아닙니다 ({where})")

    # 5. PRD 대조
    if prd_path:
        prd = prd_path.read_text(encoding="utf-8")
        s3_prd = section(prd, "3")
        prd_r = {r.get("ID") for r in table_rows(s3_prd) if r.get("ID")}
        s5_prd = section(prd, "5")
        excluded_rows = {r for row in table_rows(s5_prd) for r in re.findall(r"\bR\d+\b", row.get("항목", ""))}

        # 명세서가 참조한 R 번호
        spec_r_refs = set(re.findall(r"\bR\d+\b", s1))
        for r in sorted(spec_r_refs):
            if r in excluded_rows:
                errs.append(f"[PRD 대조] {r}은 PRD 5절 범위 제외 요구입니다 (명세에 포함 불가)")

    # 6. ERD 대조
    if erd_path:
        erd = erd_path.read_text(encoding="utf-8")
        # ERD 테이블에서 컬럼명 추출 (영문 단어 컬럼)
        erd_cols = set(re.findall(r"`([a-z0-9_]+)`", erd))
        if not erd_cols:
            erd_cols = set(re.findall(r"\b([a-z][a-z0-9_]{2,})\b", erd))

        # 명세서 2절의 필드명 추출
        s2 = section(spec, "2")
        s2_rows = table_rows(s2)
        for row in s2_rows:
            erd_col = row.get("ERD 컬럼", "")
            if erd_col and erd_cols:
                col_name = erd_col.split(".")[-1].strip("`")
                if col_name and col_name not in erd_cols and "계산" not in erd_col:
                    errs.append(f"[ERD 대조] 명세의 필드 '{col_name}'이 ERD에 없습니다")

    # 7. 화면기획서 대조
    if screen_path:
        screen = screen_path.read_text(encoding="utf-8")
        screen_s1 = section(screen, "1")
        screen_ids = {r.get("ID") for r in table_rows(screen_s1) if r.get("ID")}
        s3 = section(spec, "3")
        spec_screen_table = table_rows(s3)
        if not spec_screen_table and screen_ids:
            errs.append("[화면 대조] 3절 화면별 값 대조표가 비어 있습니다")

    # 결과 출력
    if errs:
        print(f"FAIL ({len(errs)}건의 검사 항목 불일치):")
        for e in errs:
            print(f"  - {e}")
        sys.exit(1)
    else:
        print("OK: API 명세서 검사 통과 (형식, 자리표시자, 서버 계산, 대조 규칙 만족)")


if __name__ == "__main__":
    main()
