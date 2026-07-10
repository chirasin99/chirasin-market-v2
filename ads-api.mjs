// netlify/functions/ads-api.mjs
//
// API กลางสำหรับเก็บ "ประกาศ" ทั้งหมดของ CHIRASIN MARKET ไว้ใน Netlify Blobs
// แทนที่ localStorage เดิม (ซึ่งเก็บแยกเครื่องต่อเครื่อง ไม่ได้แชร์ระหว่างลูกค้าจริงๆ)
//
// Endpoint: /api/ads
//   GET    /api/ads            -> คืนประกาศทั้งหมด (array)
//   POST   /api/ads            -> บันทึกประกาศ (สร้างใหม่ถ้าไม่มี id / อัปเดตถ้ามี id) body = ad object (JSON)
//   DELETE /api/ads?id=ad_xxx   -> ลบประกาศตาม id
//
// ไม่ต้องตั้งค่า siteID/token เอง เพราะ Netlify จะฉีดค่าที่จำเป็นให้อัตโนมัติ
// เมื่อรันผ่าน Netlify Functions (ทั้งตอน deploy จริงและตอน `netlify dev`)

import { getStore } from "@netlify/blobs";

const STORE_NAME = "chirasin-ads";

function cors() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors() });
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }

  const store = getStore(STORE_NAME);

  try {
    // ---------- GET: คืนประกาศทั้งหมด ----------
    if (req.method === "GET") {
      const { blobs } = await store.list();
      const ads = await Promise.all(
        blobs.map((b) => store.get(b.key, { type: "json" }))
      );
      return json(ads.filter(Boolean));
    }

    // ---------- POST: สร้างใหม่ หรืออัปเดต (upsert) ----------
    if (req.method === "POST") {
      const ad = await req.json();
      if (!ad || typeof ad !== "object") {
        return json({ error: "ข้อมูลประกาศไม่ถูกต้อง" }, 400);
      }
      if (!ad.id) {
        ad.id = "ad_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      }
      await store.setJSON(ad.id, ad);
      return json(ad);
    }

    // ---------- DELETE: ลบตาม id ----------
    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "ต้องระบุ id ที่จะลบ" }, 400);
      await store.delete(id);
      return json({ deleted: id });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (err) {
    console.error("[ads-api] error:", err);
    return json({ error: "เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์: " + String(err) }, 500);
  }
};

// เปิดใช้งานที่ path /api/ads (แทนที่จะเป็น /.netlify/functions/ads-api ยาวๆ)
export const config = { path: "/api/ads" };
