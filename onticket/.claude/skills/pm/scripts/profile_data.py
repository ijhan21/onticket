"""data/ 폴더의 CSV에서 PRD에 옮길 '값'만 뽑는다.

사용: python3 -I .claude/skills/pm/scripts/profile_data.py data
출력: 파일별 행 수·열 목록, 열마다 값 종류(개수가 적으면 전체 값과 빈도),
      숫자 열은 최소~최대, 코드형 열은 형식 패턴(예: ORD-########-####).
기능을 판단하지 않는다. 숫자와 형식만 보고한다.
"""
import csv
import re
import sys
from collections import Counter
from pathlib import Path

ENUM_LIMIT = 15  # 서로 다른 값이 이 이하이면 전체 값을 나열한다


def pattern(value: str) -> str:
    """숫자는 #, 숫자와 섞인 16진 대문자 묶음(QR 꼬리 등)은 X로 바꾼다."""
    def seg(s: str) -> str:
        if re.fullmatch(r"[0-9A-F]+", s) and re.search(r"[A-F]", s) and re.search(r"[0-9]", s):
            return "X" * len(s)
        return re.sub(r"[0-9]", "#", s)
    return "-".join(seg(s) for s in value.split("-"))


def is_number(v: str) -> bool:
    return re.fullmatch(r"-?\d+(\.\d+)?", v) is not None


def profile(path: Path) -> None:
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    cols = list(rows[0].keys()) if rows else []
    print(f"\n## {path.name} — {len(rows)}행")
    print("열:", ", ".join(cols))
    for col in cols:
        vals = [r[col] for r in rows if r[col] not in ("", None)]
        empty = len(rows) - len(vals)
        distinct = Counter(vals)
        head = f"- {col}: 값 {len(distinct)}종" + (f", 빈 값 {empty}" if empty else "")
        if vals and all(is_number(v) for v in vals):
            nums = [float(v) for v in vals]
            fmt = lambda x: str(int(x)) if x.is_integer() else str(x)
            head += f", 범위 {fmt(min(nums))}~{fmt(max(nums))}"
            if len(distinct) <= ENUM_LIMIT:
                head += " | " + ", ".join(f"{k}({n})" for k, n in sorted(distinct.items(), key=lambda kv: float(kv[0])))
        elif len(distinct) <= ENUM_LIMIT and not (len(distinct) == len(vals) > 3):
            head += " | " + ", ".join(f"{k}({n})" for k, n in distinct.most_common())
        else:
            pats = Counter(pattern(v) for v in vals)
            if len(pats) > 1:  # 같은 자리에 16진 문자가 한 번이라도 나오면 그 자리는 X(16진)로 묶는다
                hexpos = {i for v in vals for i, s in enumerate(v.split("-")) if "X" in pattern(s)}
                pats = Counter(
                    "-".join("X" * len(s) if i in hexpos and re.fullmatch(r"[0-9A-F]+", s) else pattern(s)
                             for i, s in enumerate(v.split("-")))
                    for v in vals)
            if len(pats) <= 3:
                head += " | 형식: " + ", ".join(f"{k}({n})" for k, n in pats.most_common())
            else:
                head += f" | 예: {', '.join(list(distinct)[:3])}"
        print(head)


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    files = sorted(root.glob("*.csv"))
    if not files:
        sys.exit(f"CSV 없음: {root}")
    for p in files:
        profile(p)


if __name__ == "__main__":
    main()
