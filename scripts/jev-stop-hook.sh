#!/usr/bin/env bash
set -e

# stdin 컨텍스트 읽기 (필요 시 버림)
cat > /dev/null

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

RUBRIC_FILE="$ROOT_DIR/.jev/rubric.md"

if [ ! -f "$RUBRIC_FILE" ]; then
  # rubric.md가 없으면 통과
  echo '{"decision": "allow"}'
  exit 0
fi

# 1. 이번 작업에서 실제로 변경/추가된 파일 목록 추출 (git diff 및 git status)
ALL_CHANGED_FILES=()

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  # staged & unstaged diff
  DIFF_FILES=$(git diff --name-only HEAD 2>/dev/null || true)
  # untracked & modified files
  STATUS_FILES=$(git status --porcelain 2>/dev/null | sed -E 's/^.{3}//' || true)

  COMBINED_FILES=$(printf "%s\n%s\n" "$DIFF_FILES" "$STATUS_FILES" | sed '/^$/d' | sort -u)
else
  COMBINED_FILES=""
fi

# 2. 코드 파일 필터링 (.ts, .tsx, .js, .jsx, .py, .rs, .sql 등)
CODE_FILES=()

# 코드 확장자 패턴
CODE_EXT_REGEX='\.(ts|tsx|js|jsx|mjs|cjs|py|rs|sql|go|java|c|cpp|h)$'

while IFS= read -r file; do
  [ -z "$file" ] && continue
  # 실제 존재하는 파일만
  if [ -f "$file" ]; then
    # .jev/ 및 .agents/ 자체 설정 파일 제외
    if [[ "$file" =~ ^\.jev/ ]] || [[ "$file" =~ ^\.agents/ ]] || [[ "$file" =~ ^\.claude/ ]] || [[ "$file" =~ ^scripts/ ]]; then
      continue
    fi
    # 코드 파일 확장자 여부 확인
    if [[ "$file" =~ $CODE_EXT_REGEX ]]; then
      CODE_FILES+=("$file")
    fi
  fi
done <<< "$COMBINED_FILES"

# 코드 파일이 없으면 (문서/설정만 변경되었거나 변경 없음) 즉시 통과
if [ ${#CODE_FILES[@]} -eq 0 ]; then
  echo '{"decision": "allow"}'
  exit 0
fi

# 3. 변경된 코드 파일들을 .jev/rubric.md의 targets에 동적으로 반영
BACKUP_FILE="${RUBRIC_FILE}.bak.$$"
cp "$RUBRIC_FILE" "$BACKUP_FILE"

# Python을 이용해 targets 필드 안전하게 갱신
python3 -c '
import sys, re

rubric_path = sys.argv[1]
code_files = sys.argv[2:]

with open(rubric_path, "r", encoding="utf-8") as f:
    content = f.read()

targets_yaml = "targets:\n" + "\n".join(f"  - \"{f}\"" for f in code_files)

# YAML frontmatter 내 targets 교체 (targets: [] 또는 targets: \n - ...)
if re.search(r"^targets:.*$", content, re.MULTILINE):
    # 기존 targets 블록 대체
    new_content = re.sub(
        r"targets:\s*(?:\[[^\]]*\]|(?:\n\s*-\s*[^\n]+)+)",
        targets_yaml,
        content,
        count=1
    )
else:
    # targets 필드가 없으면 model 아래에 삽입
    new_content = re.sub(
        r"(model:\s*\"[^\"]+\")",
        r"\1\n" + targets_yaml,
        content,
        count=1
    )

with open(rubric_path, "w", encoding="utf-8") as f:
    f.write(new_content)
' "$RUBRIC_FILE" "${CODE_FILES[@]}"

# 4. jev 실행
JEV_BIN="$(which jev 2>/dev/null || echo "$HOME/.local/bin/jev")"

if [ ! -x "$JEV_BIN" ]; then
  # jev 실행 바이너리가 없으면 복원 후 통과
  mv "$BACKUP_FILE" "$RUBRIC_FILE"
  echo '{"decision": "allow"}'
  exit 0
fi

set +e
JEV_OUTPUT=$("$JEV_BIN" 2>&1)
JEV_STATUS=$?
set -e

# 원본 rubric.md 복원
mv "$BACKUP_FILE" "$RUBRIC_FILE"

# 5. jev 결과에 따른 의사결정 반환
if [ $JEV_STATUS -eq 0 ]; then
  echo '{"decision": "allow"}'
else
  # 실패 시 에이전트 종료 차단 및 수정 요구 (reason 포함)
  if which jq >/dev/null 2>&1; then
    jq -n --arg reason "$JEV_OUTPUT" '{
      "decision": "continue",
      "reason": ("[JEV 품질 게이트 검증 실패]\n코드 변경 사항이 기획 의도 및 아키텍처 루브릭 기준을 충족하지 못했습니다:\n\n" + $reason + "\n\n루브릭(.jev/rubric.md) 기준에 맞춰 코드를 수정한 뒤 다시 완료하십시오.")
    }'
  else
    # jq가 없을 경우 안전한 fallback
    SAFE_REASON=$(echo "$JEV_OUTPUT" | tr '\n' ' ' | sed 's/"/\\"/g')
    echo "{\"decision\": \"continue\", \"reason\": \"[JEV 품질 게이트 검증 실패] $SAFE_REASON\"}"
  fi
fi

exit 0
