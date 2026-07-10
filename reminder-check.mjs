// netlify/functions/reminder-check.mjs
//
// รันอัตโนมัติทุกวัน (ไม่ต้องมีใครเปิดเว็บอยู่เลย) เพื่อ:
//   1) ลบประกาศที่หมดอายุจริงออกจากฐานข้อมูลกลาง (ทั้งแบบฟรี 7 วัน และแบบจ่ายเงิน 15/30 วัน)
//   2) เป็นจุดที่ควรเชื่อมต่อผู้ให้บริการ SMS จริง ถ้าต้องการส่งข้อความเตือนเข้ามือถือลูกค้า
//      อัตโนมัติ 100% (ดูคอมเมนต์ sendSmsReminder ด้านล่าง — ตอนนี้ยังไม่ได้เปิดใช้งานจริง
//      เพราะต้องสมัครผู้ให้บริการ SMS แยกต่างหาก เช่น ThaiBulkSMS, Twilio, AIS/DTAC SMS API)

import { getStore } from "@netlify/blobs";

const STORE_NAME = "chirasin-ads";
const REMINDER_DAYS = 2; // แจ้งเตือนล่วงหน้ากี่วันก่อนเว็บจะลง (ต้องตรงกับ REMINDER_DAYS ในหน้าเว็บ)
const DAY_MS = 24 * 60 * 60 * 1000;

// ตัวอย่างฟังก์ชันส่ง SMS จริง (ยังปิดใช้งานอยู่ — uncomment และใส่ค่า API ของผู้ให้บริการเพื่อเปิดใช้จริง)
// async function sendSmsReminder(phone, message) {
//   await fetch("https://api.your-sms-provider.com/send", {
//     method: "POST",
//     headers: { "Authorization": "Bearer " + process.env.SMS_API_KEY, "Content-Type": "application/json" },
//     body: JSON.stringify({ to: phone, message }),
//   });
// }

export default async () => {
  const store = getStore(STORE_NAME);
  const { blobs } = await store.list();
  const now = Date.now();

  let removed = 0;
  let reminded = 0;

  for (const b of blobs) {
    const ad = await store.get(b.key, { type: "json" });
    if (!ad) continue;

    // หมดอายุจริงแล้ว -> เอาลงจากกระดานประกาศ
    if (ad.expireAt && ad.expireAt <= now) {
      await store.delete(b.key);
      removed++;
      continue;
    }

    // ใกล้หมดอายุ (เหลือ <= 2 วัน) และยังไม่เคยแจ้งเตือนไป -> จุดเชื่อมต่อ SMS จริง
    if (ad.expireAt) {
      const daysLeft = Math.ceil((ad.expireAt - now) / DAY_MS);
      if (daysLeft <= REMINDER_DAYS && ad.phone && !ad.reminderSent) {
        // await sendSmsReminder(ad.phone,
        //   `ประกาศ "${ad.title}" ของคุณเหลือเวลาอีก ${daysLeft} วัน สแกน QR จ่ายเพื่อต่ออายุที่ CHIRASIN MARKET`);
        ad.reminderSent = true;
        await store.setJSON(b.key, ad);
        reminded++;
      }
    }
  }

  console.log(`[reminder-check] removed=${removed} reminded=${reminded} total=${blobs.length}`);
};

// รันทุกวันเวลาเที่ยงคืน UTC
export const config = { schedule: "@daily" };
