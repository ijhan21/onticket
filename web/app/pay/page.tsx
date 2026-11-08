"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PayRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order") || searchParams.get("order_id") || "";

  useEffect(() => {
    if (orderId) {
      const params = new URLSearchParams(searchParams.toString());
      if (!params.has("order_id")) {
        params.set("order_id", orderId);
      }
      params.delete("order");
      router.replace(`/orders/payment?${params.toString()}`);
    } else {
      router.replace("/");
    }
  }, [orderId, searchParams, router]);

  return null;
}

export default function PayRedirectPage() {
  return (
    <Suspense fallback={null}>
      <PayRedirectContent />
    </Suspense>
  );
}
