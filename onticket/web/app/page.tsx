"use client";

import { useEffect, useState } from "react";
import { fetchHealth } from "@/lib/api-client/client";

export default function HomePage() {
  const [healthStatus, setHealthStatus] = useState<string>("확인 중...");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

  useEffect(() => {
    fetchHealth()
      .then((data) => {
        setHealthStatus(data.status || "ok");
      })
      .catch((err) => {
        setHealthStatus("연결 실패");
        console.error("API 연결 실패:", err);
      });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md border border-slate-200 p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">온티켓 (OnTicket)</h1>
        <p className="text-sm text-slate-500 mb-6">프론트엔드 - API 서버 통신 뼈대 검증</p>

        <div className="p-4 bg-slate-100 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500 mb-1">
            API 서버 ({apiUrl}) 상태
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span
              id="health-status"
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold font-mono ${
                healthStatus === "ok"
                  ? "bg-green-100 text-green-800 border border-green-300"
                  : "bg-amber-100 text-amber-800 border border-amber-300"
              }`}
            >
              {healthStatus}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
