import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import postgres from "postgres";

// Dedicated disposable LOCAL PostgreSQL only. Never use the Cloud connection.
// Execute the real migration functions, not a JavaScript imitation of the rules.
const connection = process.env["INVITE_TEST_DATABASE_URL"];
if (connection) {
  const url = new URL(connection);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname !== "/invite_security_test") {
    throw new Error("Invitation tests require a disposable local invite_security_test database");
  }
}
const migration = readFileSync("drizzle/migrations/0007_secure_invite_links.sql", "utf8");
function migrationFunction(name: string) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const end = migration.indexOf("END $$;", start);
  if (start < 0 || end < 0) throw new Error(`Missing migration function: ${name}`);
  return migration.slice(start, end + "END $$;".length);
}
const suite = connection ? describe : describe.skip;
suite("backend invitation token rotation (isolated PostgreSQL)", () => {
  const email = "rotation-test@example.invalid";
  async function transaction(check: (sql: postgres.TransactionSql) => Promise<void>) {
    if (!connection) throw new Error("Missing isolated invitation test connection");
    const db = postgres(connection, { max: 1, onnotice: () => {} });
    try {
      await db.begin(async (sql) => {
        // Minimal fixtures: no employees, hotel membership triggers or acceptance calls.
        await sql.unsafe(`
          CREATE SCHEMA auth;
          CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-4000-8000-000000000001'::uuid $$;
          CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"email":"${email}"}'::jsonb $$;
          CREATE TABLE public.hotels(id uuid PRIMARY KEY, name text);
          CREATE TABLE public.hotel_invites(
            hotel_id uuid, email text, role text, position text, token uuid DEFAULT gen_random_uuid() UNIQUE,
            expires_at timestamptz, revoked_at timestamptz, accepted_at timestamptz, accepted_by uuid,
            PRIMARY KEY(hotel_id,email)
          );
        `);
        await sql.unsafe(migrationFunction("suite_guard_invite"));
        await sql.unsafe(migrationFunction("suite_invite_info"));
        await sql.unsafe("CREATE TRIGGER invites_guard BEFORE INSERT OR UPDATE ON public.hotel_invites FOR EACH ROW EXECUTE FUNCTION public.suite_guard_invite()");
        await check(sql);
        throw new Error("ROLLBACK_FIXTURE");
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "ROLLBACK_FIXTURE") throw error;
    } finally { await db.end(); }
  }
  async function setup(sql: postgres.TransactionSql) {
    const [hotel] = await sql`insert into public.hotels values(gen_random_uuid(),'Isolated invitation fixture') returning id`;
    if (!hotel) throw new Error("Missing hotel fixture");
    const id = hotel["id"] as string;
    await sql`insert into public.hotel_invites(hotel_id,email,role,expires_at) values(${id},${email},'maintenance',now()+interval '7 days')`;
    return { id, token: await tokenOf(sql, id) };
  }
  async function tokenOf(sql: postgres.TransactionSql, id: string) {
    const [row] = await sql`select token from public.hotel_invites where hotel_id=${id} and email=${email}`;
    if (!row) throw new Error("Missing invitation fixture");
    return row["token"] as string;
  }
  async function status(sql: postgres.TransactionSql, token: string) {
    const [row] = await sql`select public.suite_invite_info(${token}::uuid)->>'status' as status`;
    if (!row) throw new Error("Missing validation result");
    return row["status"];
  }
  async function assertRotated(sql: postgres.TransactionSql, id: string, old: string) {
    const fresh = await tokenOf(sql, id);
    expect(fresh).not.toBe(old);
    expect(await status(sql, old)).toBe("invalid");
    expect(await status(sql, fresh)).toBe("ok");
    return fresh;
  }

  it("revocation rejects the token; renewal rejects the old token and validates the new", async () => {
    await transaction(async sql => {
      const { id, token: old } = await setup(sql);
      expect(await status(sql, old)).toBe("ok");
      await sql`update public.hotel_invites set revoked_at=now() where hotel_id=${id}`;
      expect(await status(sql, old)).toBe("revoked");
      await sql`update public.hotel_invites set revoked_at=null,expires_at=now()+interval '8 days' where hotel_id=${id}`;
      await assertRotated(sql, id, old);
    });
  });
  it("clearing revocation alone rotates the token", async () => {
    await transaction(async sql => {
      const { id, token: old } = await setup(sql);
      await sql`update public.hotel_invites set revoked_at=now() where hotel_id=${id}`;
      await sql`update public.hotel_invites set revoked_at=null where hotel_id=${id}`;
      await assertRotated(sql, id, old);
    });
  });
  it("a client cannot restore an old token during or after renewal", async () => {
    await transaction(async sql => {
      const { id, token: old } = await setup(sql);
      await sql`update public.hotel_invites set revoked_at=now() where hotel_id=${id}`;
      await sql`update public.hotel_invites set revoked_at=null,token=${old} where hotel_id=${id}`;
      const fresh = await assertRotated(sql, id, old);
      await sql`update public.hotel_invites set token=${old} where hotel_id=${id}`;
      expect(await tokenOf(sql, id)).toBe(fresh);
      expect(await status(sql, old)).toBe("invalid");
    });
  });
  it("re-inviting the same email invalidates its old token", async () => {
    await transaction(async sql => {
      const { id, token: old } = await setup(sql);
      await sql`insert into public.hotel_invites(hotel_id,email,role,expires_at) values(${id},${email},'maintenance',now()+interval '9 days')
        on conflict(hotel_id,email) do update set revoked_at=null,expires_at=excluded.expires_at`;
      await assertRotated(sql, id, old);
    });
  });
  it("later renewals never restore any earlier token", async () => {
    await transaction(async sql => {
      const { id, token: first } = await setup(sql);
      await sql`update public.hotel_invites set expires_at=now()+interval '8 days' where hotel_id=${id}`;
      const second = await assertRotated(sql, id, first);
      await sql`update public.hotel_invites set expires_at=now()+interval '9 days' where hotel_id=${id}`;
      const third = await assertRotated(sql, id, second);
      expect(third).not.toBe(first);
      expect(await status(sql, first)).toBe("invalid");
    });
  });
  it("a new invitation ignores a caller-supplied token", async () => {
    await transaction(async sql => {
      const { id } = await setup(sql);
      const supplied = "00000000-0000-4000-8000-000000000099";
      const [row] = await sql`insert into public.hotel_invites(hotel_id,email,role,token,expires_at)
        values(${id},'other@example.invalid','maintenance',${supplied},now()+interval '7 days') returning token`;
      expect(row?.["token"]).toBeDefined();
      expect(row?.["token"]).not.toBe(supplied);
      expect(await status(sql, supplied)).toBe("invalid");
    });
  });
});
