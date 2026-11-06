import { describe, expect, it } from "vitest";
import postgres from "postgres";

// Backend rule (suite_guard_invite): renewing or re-sending an invite issues a new token; old tokens never return.
// Runs only with the supplied Cloud connection; every fixture rolls back, nothing persists.
const connection = process.env["SUPABASE_DB_URL"];
const suite = connection ? describe : describe.skip;
suite("invite token rotation (transactional, rolled back)", () => {
  async function transaction(check: (sql: postgres.TransactionSql) => Promise<void>) {
    const db = postgres(connection!, { max: 1 });
    try {
      await db.begin(async (sql) => { await check(sql); throw new Error("ROLLBACK_FIXTURE"); });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "ROLLBACK_FIXTURE") throw error;
    } finally { await db.end(); }
  }
  const owner = "3bb2396f-77b9-4263-bc2d-6d3899511546";
  const email = "rotation-test@example.invalid";
  async function setup(sql: postgres.TransactionSql) {
    await sql`select set_config('request.jwt.claim.sub', ${owner}, true)`;
    const [h] = await sql`insert into public.hotels(org_owner,key,name) values (${owner},gen_random_uuid()::text,'Token rotation test') returning id`;
    const id = h!["id"] as string;
    const [i] = await sql`insert into public.hotel_invites(hotel_id,email,role,full_name,position,expires_at) values (${id},${email},'maintenance','Test','Test',now()+interval '7 days') returning token`;
    return { id, token: i!["token"] as string };
  }
  const tokenOf = async (sql: postgres.TransactionSql, id: string) =>
    (await sql`select token from public.hotel_invites where hotel_id=${id} and email=${email}`)[0]!["token"] as string;
  const found = async (sql: postgres.TransactionSql, token: string) =>
    (await sql`select 1 from public.hotel_invites where token=${token}`).length;

  it("renewing a revoked invite issues a new token and the old one stops existing", async () => {
    await transaction(async (sql) => {
      const { id, token: old } = await setup(sql);
      await sql`update public.hotel_invites set revoked_at=now() where hotel_id=${id} and email=${email}`;
      expect(await tokenOf(sql, id)).toBe(old); // revoked keeps token, but it is revoked
      await sql`update public.hotel_invites set revoked_at=null, expires_at=now()+interval '7 days' where hotel_id=${id} and email=${email}`;
      const fresh = await tokenOf(sql, id);
      expect(fresh).not.toBe(old);
      expect(await found(sql, old)).toBe(0);
      expect(await found(sql, fresh)).toBe(1);
    });
  });
  it("clearing revocation alone (without new expiry) still rotates the token", async () => {
    await transaction(async (sql) => {
      const { id, token: old } = await setup(sql);
      await sql`update public.hotel_invites set revoked_at=now() where hotel_id=${id} and email=${email}`;
      await sql`update public.hotel_invites set revoked_at=null where hotel_id=${id} and email=${email}`;
      expect(await found(sql, old)).toBe(0);
    });
  });
  it("a client cannot set the token back to an old value", async () => {
    await transaction(async (sql) => {
      const { id, token: old } = await setup(sql);
      await sql`update public.hotel_invites set revoked_at=now() where hotel_id=${id} and email=${email}`;
      await sql`update public.hotel_invites set revoked_at=null, token=${old} where hotel_id=${id} and email=${email}`;
      expect(await tokenOf(sql, id)).not.toBe(old);
    });
  });
  it("re-sending an invite to the same email issues a new token", async () => {
    await transaction(async (sql) => {
      const { id, token: old } = await setup(sql);
      await sql`insert into public.hotel_invites(hotel_id,email,role,full_name,position,expires_at) values (${id},${email},'maintenance','Test','Test',now()+interval '7 days')
        on conflict (hotel_id,email) do update set revoked_at=null, expires_at=excluded.expires_at`;
      expect(await tokenOf(sql, id)).not.toBe(old);
      expect(await found(sql, old)).toBe(0);
    });
  });
});
