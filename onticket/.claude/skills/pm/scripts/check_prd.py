"""작성한 PRD가 템플릿 형식과 작성 규칙을 지켰는지 검사한다.

사용: python3 -I .claude/skills/pm/scripts/check_prd.py docs/PRD.md [docs/templates/PRD-템플릿.md]
통과하면 'OK'와 요약을, 어기면 위반 목록을 출력하고 종료 코드 1로 끝난다.

검사 항목
 형식  1. 절(##) 제목과 순서가 템플릿과 같다
       2. 각 표의 열 이름·순서가 템플릿과 같고, 빈 칸이 없다
       3. {자리표시}, '작성 안내', 템플릿의 규칙 글머리가 남지 않았다
       4. 머리 항목(버전·상태·작성일·입력)과 1절 글머리(핵심 흐름·목표·제약·임시 규칙)가 있다
 3절   5. ID는 R1, R2… 중복 없음. 상태는 '확정' 또는 '미확정'
       6. [미결]·[충돌]이 붙은 요구는 6절 질문 문장에 그 R번호가 나온다
 4절   7. 대상 R이 3절에 있고 '확정'이며 [미결]·[충돌]이 없다
       8. 조건은 '정상:'·'경계:'·'실패:' 중 하나로 시작한다
       9. '확정' 요구마다 정상·경계·실패가 모두 있다
 5절  10. 이유는 정해진 셋 중 하나다
 6절  11. ID는 Q1, Q2… 중복 없음, 결정자가 있다
 확정 12. 문서 상태가 '확정'이면 3절에 '미확정'·[미결]·[충돌]이 없다
"""
import re
import sys
from pathlib import Path

H2 = re.compile(r"^##\s+(.*)$")
SEP = re.compile(r"^\|\s*:?-{3,}")
REASON = re.compile(r"^(1차 범위 밖\(개발 리더 결정\)|입력에서 미룸|뒤 단계에서 정함\((화면|데이터|API)\))$")
TAG = re.compile(r"\[(미결|충돌)\]")


def cells(line: str) -> list[str]:
    line = line.strip().strip("|").replace("\\|", "\0")
    return [c.replace("\0", "|").strip() for c in line.split("|")]


def parse(text: str):
    """절 제목 목록, {절: [(헤더, 행들)]}, {절: [본문 줄]}을 돌려준다."""
    heads, tables, body = [], {}, {}
    cur, lines, i = "(머리)", text.splitlines(), 0
    while i < len(lines):
        line = lines[i]
        m = H2.match(line)
        if m:
            cur = m.group(1).strip()
            heads.append(cur)
        elif line.startswith("|") and i + 1 < len(lines) and SEP.match(lines[i + 1]):
            header, rows = cells(line), []
            i += 2
            while i < len(lines) and lines[i].startswith("|"):
                rows.append(cells(lines[i]))
                i += 1
            tables.setdefault(cur, []).append((header, rows))
            continue
        else:
            body.setdefault(cur, []).append(line)
        i += 1
    return heads, tables, body


def rows_of(tables, num: str):
    for title, ts in tables.items():
        if title.startswith(num + "."):
            return [dict(zip(h, r)) for h, rows in ts for r in rows]
    return []


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    prd = Path(sys.argv[1]).read_text(encoding="utf-8")
    tpl = Path(sys.argv[2] if len(sys.argv) > 2 else "docs/templates/PRD-템플릿.md").read_text(encoding="utf-8")
    errs: list[str] = []

    th, tt, tb = parse(tpl)
    ph, pt, pb = parse(prd)

    # 1. 절
    if th != ph:
        miss = [h for h in th if h not in ph]
        extra = [h for h in ph if h not in th]
        errs += [f"[절] 빠진 절: {miss}"] if miss else []
        errs += [f"[절] 템플릿에 없는 절: {extra}"] if extra else []
        if not miss and not extra:
            errs.append("[절] 절 순서가 템플릿과 다르다")

    # 2. 표 열·빈 칸
    for title, ttabs in tt.items():
        ptabs = pt.get(title, [])
        if len(ptabs) != len(ttabs):
            errs.append(f"[표] '{title}' 표 {len(ptabs)}개 (템플릿 {len(ttabs)}개)")
            continue
        for (thd, _), (phd, prows) in zip(ttabs, ptabs):
            if thd != phd:
                errs.append(f"[열] '{title}' 열 {phd} ≠ 템플릿 {thd}")
            for r in prows:
                if len(r) != len(phd):
                    errs.append(f"[열] '{title}' 칸 수가 열 수와 다르다: {r}")
                elif any(c == "" for c in r):
                    errs.append(f"[빈칸] '{title}': {r}")

    # 3. 남은 자리표시·안내·규칙 글머리
    rule_lines = {l.strip() for ls in tb.values() for l in ls if l.strip().startswith("- ") and not re.match(r"- (버전|상태|작성일|입력|핵심 흐름|목표|제약|임시 규칙):", l.strip())}
    for n, line in enumerate(prd.splitlines(), 1):
        s = line.strip()
        if re.search(r"\{[^}]*\}", s):
            errs.append(f"[자리표시] {n}행: {s[:70]}")
        if s.startswith("> 작성 안내"):
            errs.append(f"[안내] {n}행의 작성 안내를 지우지 않았다")
        if s in rule_lines:
            errs.append(f"[규칙 글머리] {n}행이 템플릿 규칙 그대로 남았다: {s[:50]}…")

    # 4. 머리 항목·1절 글머리
    text_head = "\n".join(pb.get("(머리)", []))
    for key in ("버전", "상태", "작성일", "입력"):
        if not re.search(rf"^- {key}: \S", text_head, re.M):
            errs.append(f"[머리] '- {key}:' 항목이 없다")
    m = re.search(r"^- 상태: (\S+)", text_head, re.M)
    doc_state = m.group(1) if m else ""
    if doc_state not in ("초안", "확정"):
        errs.append(f"[머리] 상태 '{doc_state}'는 '초안' 또는 '확정'이어야 한다")
    sec1 = "\n".join(next((v for k, v in pb.items() if k.startswith("1.")), []))
    for key in ("핵심 흐름", "목표", "제약", "임시 규칙"):
        if not re.search(rf"^- {key}: \S", sec1, re.M):
            errs.append(f"[1절] '- {key}:' 글머리가 없다")

    # 5~6. 3절
    reqs = rows_of(pt, "3")
    rmap = {}
    for r in reqs:
        rid = r.get("ID", "")
        if not re.fullmatch(r"R\d+", rid):
            errs.append(f"[3절] ID '{rid}'는 R+숫자가 아니다")
        if rid in rmap:
            errs.append(f"[3절] {rid} 중복")
        rmap[rid] = r
        if r.get("상태") not in ("확정", "미확정"):
            errs.append(f"[3절] {rid} 상태 '{r.get('상태')}'는 확정/미확정이어야 한다")
    questions = rows_of(pt, "6")
    qtext = " ".join(q.get("질문", "") for q in questions)
    for rid, r in rmap.items():
        if TAG.search(r.get("요구 (한 문장)", "")) and not re.search(rf"\b{rid}\b", qtext):
            errs.append(f"[3절] {rid}에 [미결]/[충돌]이 붙었는데 6절 질문에 {rid}가 없다")

    # 7~9. 4절
    kinds_by_r: dict[str, set] = {}
    for a in rows_of(pt, "4"):
        aid, tgt, cond = a.get("ID", ""), a.get("대상", ""), a.get("조건", "")
        if not re.fullmatch(r"AC\d+", aid):
            errs.append(f"[4절] ID '{aid}'는 AC+숫자가 아니다")
        if tgt not in rmap:
            errs.append(f"[4절] {aid} 대상 {tgt}가 3절에 없다")
        else:
            r = rmap[tgt]
            if r.get("상태") != "확정" or TAG.search(r.get("요구 (한 문장)", "")):
                errs.append(f"[4절] {aid}: {tgt}는 확정이 아니거나 [미결]/[충돌]인데 완료 기준을 썼다")
        k = re.match(r"(정상|경계|실패):", cond)
        if not k:
            errs.append(f"[4절] {aid} 조건이 '정상:'·'경계:'·'실패:'로 시작하지 않는다")
        else:
            kinds_by_r.setdefault(tgt, set()).add(k.group(1))
    confirmed = [rid for rid, r in rmap.items() if r.get("상태") == "확정" and not TAG.search(r.get("요구 (한 문장)", ""))]
    for rid in confirmed:
        lack = [k for k in ("정상", "경계", "실패") if k not in kinds_by_r.get(rid, set())]
        if lack:
            errs.append(f"[4절] 확정 {rid}에 빠진 완료 기준: {'/'.join(lack)}")

    # 10. 5절
    for x in rows_of(pt, "5"):
        if not REASON.match(x.get("이유", "")):
            errs.append(f"[5절] '{x.get('항목')}' 이유 '{x.get('이유')}'는 정해진 셋 중 하나가 아니다")

    # 11. 6절
    seen = set()
    for q in questions:
        qid = q.get("ID", "")
        if not re.fullmatch(r"Q\d+", qid) or qid in seen:
            errs.append(f"[6절] ID '{qid}'가 Q+숫자가 아니거나 중복이다")
        seen.add(qid)

    # 12. 확정 문서
    if doc_state == "확정":
        for rid, r in rmap.items():
            if r.get("상태") == "미확정" or TAG.search(r.get("요구 (한 문장)", "")):
                errs.append(f"[확정] 확정 문서인데 {rid}가 미확정·[미결]·[충돌]이다")

    if errs:
        print(f"위반 {len(errs)}건")
        for e in errs:
            print(" -", e)
        sys.exit(1)
    pend = sum(1 for r in rmap.values() if r.get("상태") == "미확정")
    tagged = sum(1 for r in rmap.values() if TAG.search(r.get("요구 (한 문장)", "")))
    print(f"OK — 요구 {len(rmap)}개(확정·결정됨 {len(confirmed)}, 미확정 {pend}, [미결]/[충돌] {tagged}), "
          f"완료 기준 {len(rows_of(pt, '4'))}행(정상·경계·실패를 갖춘 요구 {sum(1 for v in kinds_by_r.values() if len(v) == 3)}개), "
          f"범위 제외 {len(rows_of(pt, '5'))}, 질문 {len(questions)}")


if __name__ == "__main__":
    main()
