#!/usr/bin/env python3
"""백엔드 구현 코드(api/)가 프로젝트 구조와 코딩 컨벤션을 준수하는지 검사한다.

사용법:
  python3 -I .claude/skills/backend/scripts/check_backend.py
"""
import json
import subprocess
import sys
from pathlib import Path

REQUIRED_DIRS = [
    "api/src/routes",
    "api/src/services",
    "api/src/repositories",
    "api/src/schemas",
    "api/src/lib",
]

REQUIRED_FILES = [
    "api/package.json",
    "api/tsconfig.json",
    "api/src/index.ts",
    "api/src/lib/http.ts",
    "api/src/lib/auth.ts",
]


def main() -> None:
    root = Path.cwd()
    if not (root / "api").exists() and (root / "onticket" / "api").exists():
        root = root / "onticket"

    errs: list[str] = []

    # 1. 필수 디렉터리 검사
    for rd in REQUIRED_DIRS:
        target = root / rd
        if not target.is_dir():
            errs.append(f"[디렉터리 누락] '{rd}' 디렉터리가 없습니다.")

    # 2. 필수 파일 검사
    for rf in REQUIRED_FILES:
        target = root / rf
        if not target.is_file():
            errs.append(f"[파일 누락] '{rf}' 파일이 없습니다.")

    # 3. package.json 검사
    pkg_path = root / "api" / "package.json"
    if pkg_path.is_file():
        try:
            pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
            scripts = pkg.get("scripts", {})
            if "typecheck" not in scripts:
                errs.append("[스크립트 누락] api/package.json에 'typecheck' 스크립트가 없습니다.")
        except Exception as e:
            errs.append(f"[패키지 오류] api/package.json 파싱 실패: {e}")

    # 4. TypeScript 타입 검사 실행 (api/ 디렉터리에서 실행)
    api_dir = root / "api"
    if api_dir.is_dir():
        res = subprocess.run(
            ["npm", "run", "typecheck"],
            cwd=api_dir,
            capture_output=True,
            text=True,
        )
        if res.returncode != 0:
            errs.append(f"[타입 검사 실패]\n{res.stdout}\n{res.stderr}")

    if errs:
        print(f"FAIL ({len(errs)}건의 검사 항목 불일치):")
        for e in errs:
            print(f"  - {e}")
        sys.exit(1)
    else:
        print("OK: 백엔드 기본 구조 및 TypeScript 타입 검사 통과")


if __name__ == "__main__":
    main()
