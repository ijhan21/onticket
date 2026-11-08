#!/usr/bin/env python3
"""Antigravity PreToolUse Hook: 데이터베이스 파괴 명령(DROP TABLE, TRUNCATE 등) 차단

stdin으로 들어오는 run_command toolCall 인자를 검사하여
파괴적 명령어가 포함되어 있으면 execution을 deny합니다.
"""
import sys
import json
import re

DESTRUCTIVE_PATTERN = re.compile(
    r"\b(DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE|DROP\s+SCHEMA)\b",
    re.IGNORECASE
)

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"decision": "allow"}))
            return

        payload = json.loads(raw_input)
        tool_call = payload.get("toolCall", {})
        tool_name = tool_call.get("name", "")
        args = tool_call.get("args", {})
        command_line = args.get("CommandLine", "")

        if DESTRUCTIVE_PATTERN.search(command_line):
            output = {
                "decision": "deny",
                "reason": (
                    "[차단] 데이터베이스 파괴 명령이 감지되어 실행을 차단했습니다.\n"
                    "- 감지된 명령: DROP TABLE, DROP DATABASE, TRUNCATE 등\n"
                    "- 사유: 코드는 다시 짤 수 있지만, 데이터는 복구할 원본이 없습니다.\n"
                    "- 조치 안내: 테이블 삭제나 초기화가 꼭 필요하다면 Supabase 웹 대시보드(SQL Editor)에서 사람이 직접 실행해 주세요."
                )
            }
            print(json.dumps(output, ensure_ascii=False))
            return

        print(json.dumps({"decision": "allow"}))
    except Exception as e:
        # 훅 오류 시 안전하게 기본 allow 처리하되 에러 로그
        sys.stderr.write(f"Hook error: {e}\n")
        print(json.dumps({"decision": "allow"}))

if __name__ == "__main__":
    main()
