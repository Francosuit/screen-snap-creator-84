import { describe, expect, it } from "vitest";
import postgres from "postgres";

// Runs against Cloud only when its supplied connection is present; every fixture rolls back.
const connection = process.env.SUPABASE_DB_URL;
const suite = connection ? describe : describe.skip;
suite("Cloud owner trigger integration (transactional, privileged connection, not RLS)", () => {
  async function transaction(check: (sql: postgres.TransactionSql) => Promise<void>) {
    if (!connection) throw new Error("Cloud connection unavailable");
    const db = postgres(connection, { max: 1 });
    try {
      await db.begin(async (sql) => {
        await check(sql);
        throw new Error("ROLLBACK_FIXTURE");
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "ROLLBACK_FIXTURE") throw error;
    } finally { await db.end(); }
  }
  const owner = "3bb2396f-77b9-4263-bc2d-6d3899511546";
  const other = "2b2bc10d-7cf6-4137-a456-e81d31794002";
  async function hotel(sql: postgres.TransactionSql) {
    await sql`select set_config('request.jwt.claim.sub', ${owner}, true)`;
    const [row] = await sql`insert into public.hotels(org_owner,key,name) values (${owner},gen_random_uuid()::text,'Transactional P0 test') returning id`;
    if (!row) throw new Error("Hotel fixture failed");
    return row.id as string;
  }
  it("allows the recorded creator to receive owner membership", async () => {
    await transaction(async (sql) => {
      const id = await hotel(sql);
      const rows = await sql`insert into public.hotel_members(hotel_id,user_id,role) values (${id},${owner},'owner') returning role`;
      expect(rows[0]?.role).toBe("owner");
    });
  });
  it("blocks owner membership for a user from another organization", async () => {
    await expect(transaction(async (sql) => {
      const id = await hotel(sql);
      await sql`insert into public.hotel_members(hotel_id,user_id,role) values (${id},${other},'owner')`;
    })).rejects.toMatchObject({ code: "42501" });
  });
  it("blocks staff promoting themselves to owner", async () => {
    await expect(transaction(async (sql) => {
      const id = await hotel(sql);
      await sql`insert into public.hotel_members(hotel_id,user_id,role) values (${id},${other},'reception')`;
      await sql`select set_config('request.jwt.claim.sub', ${other}, true)`;
      await sql`update public.hotel_members set role='owner' where hotel_id=${id} and user_id=${other}`;
    })).rejects.toMatchObject({ code: "42501" });
  });
  it("blocks ownership transfers through hotel updates", async () => {
    await expect(transaction(async (sql) => {
      const id = await hotel(sql);
      await sql`update public.hotels set org_owner=${other} where id=${id}`;
    })).rejects.toMatchObject({ code: "42501" });
  });
  it("never allows an invitation to grant owner", async () => {
    await expect(transaction(async (sql) => {
      const id = await hotel(sql);
      await sql`insert into public.hotel_invites(hotel_id,email,role) values (${id},'transactional@example.invalid','owner')`;
    })).rejects.toMatchObject({ code: "42501" });
  });
});