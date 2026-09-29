import { timingSafeEqual } from 'node:crypto';
import { del, get, list } from '@vercel/blob';

const PREFIX = 'registrations/';

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function authorized(request) {
  const expected = process.env.ADMIN_PASSWORD || '';
  const given = request.headers.get('x-admin-password') || '';
  const a = Buffer.from(given), b = Buffer.from(expected);
  return expected.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

async function deny() {
  await new Promise((r) => setTimeout(r, 600)); // 무차별 대입 속도 늦추기
  return json({ ok: false, error: 'unauthorized' }, 401);
}

// 관리자: 신청자 목록 조회
export async function GET(request) {
  if (!authorized(request)) return deny();

  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const items = await Promise.all(blobs.map(async (b) => {
    try {
      const res = await get(b.pathname, { access: 'private', useCache: false });
      if (!res || res.statusCode !== 200) return null;
      return { ...JSON.parse(await new Response(res.stream).text()), pathname: b.pathname };
    } catch { return null; }
  }));

  const rows = items.filter(Boolean).sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));
  return json({ ok: true, rows });
}

// 관리자: 신청 1건 삭제 (테스트 신청 정리용)
export async function DELETE(request) {
  if (!authorized(request)) return deny();
  const pathname = new URL(request.url).searchParams.get('pathname') || '';
  if (!pathname.startsWith(PREFIX) || pathname.includes('..')) return json({ ok: false, error: 'bad_path' }, 400);
  await del(pathname);
  return json({ ok: true });
}
