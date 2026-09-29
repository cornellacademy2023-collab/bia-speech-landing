import { put } from '@vercel/blob';

const LIMITS = { role: 20, name: 40, phone: 20, org: 80, count: 10, email: 120, msg: 1000 };
const ROLES = ['강사·원장', '학부모', '학생', '기타'];

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// 설명회 참가 신청 1건을 비공개 Blob 저장소에 JSON 파일로 저장합니다.
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  if (!body || typeof body !== 'object') return json({ ok: false, error: 'bad_body' }, 400);
  if (body._honey) return json({ ok: true }); // 스팸봇

  const rec = {};
  for (const [k, max] of Object.entries(LIMITS)) rec[k] = String(body[k] ?? '').trim().slice(0, max);

  if (!ROLES.includes(rec.role)) return json({ ok: false, error: 'role' }, 400);
  if (!rec.name) return json({ ok: false, error: 'name' }, 400);
  if (!/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(rec.phone)) return json({ ok: false, error: 'phone' }, 400);
  if (body.agree !== true) return json({ ok: false, error: 'agree' }, 400);

  const now = new Date();
  rec.agree = true;
  rec.createdAt = now.toISOString();
  rec.id = `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;

  await put(`registrations/${rec.id}.json`, JSON.stringify(rec), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
  return json({ ok: true, id: rec.id });
}
