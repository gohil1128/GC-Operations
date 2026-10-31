import { describe, it, expect, vi, beforeEach } from "vitest";

/*
  Ownership guards for client-supplied foreign keys.

  Seven action files wrote ids straight from the request into rows — supplierId,
  ingredientId, eventId, employeeId. With one business that is harmless. With
  two on one deployment it is a cross-tenant WRITE: createPoAction accepted any
  ingredientId, and receivePoAction then ran ingredient.update() on it,
  incrementing another business's stock and overwriting their average cost.
*/

const findFirst = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplier: { findFirst: (...a: any[]) => findFirst(...a), findMany: (...a: any[]) => findMany(...a) },
    ingredient: { findFirst: (...a: any[]) => findFirst(...a), findMany: (...a: any[]) => findMany(...a) },
    event: { findFirst: (...a: any[]) => findFirst(...a), findMany: (...a: any[]) => findMany(...a) },
    employee: { findFirst: (...a: any[]) => findFirst(...a), findMany: (...a: any[]) => findMany(...a) },
    vendor: { findFirst: (...a: any[]) => findFirst(...a), findMany: (...a: any[]) => findMany(...a) },
  },
}));

const { ownedId, requiredOwnedId, assertAllOwned } = await import("@/lib/ownership");

const BIZ = "biz_mine";

beforeEach(() => {
  findFirst.mockReset();
  findMany.mockReset();
});

describe("ownedId", () => {
  it("always constrains the query to the caller's business", async () => {
    findFirst.mockResolvedValue({ id: "sup_1" });
    await ownedId("supplier", BIZ, "sup_1");
    // The whole point: businessId must be in the where clause, every time.
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sup_1", businessId: BIZ } }),
    );
  });

  it("returns the id when it belongs to this business", async () => {
    findFirst.mockResolvedValue({ id: "sup_1" });
    expect(await ownedId("supplier", BIZ, "sup_1")).toBe("sup_1");
  });

  it("throws when the id belongs to someone else", async () => {
    findFirst.mockResolvedValue(null); // scoped query finds nothing
    await expect(ownedId("supplier", BIZ, "sup_theirs")).rejects.toThrow(/Supplier not found/);
  });

  it("treats absent as absent, not as an error — these keys are optional", async () => {
    for (const empty of [null, undefined, "", "   "]) {
      expect(await ownedId("event", BIZ, empty as any)).toBeNull();
    }
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("trims before looking up, so padding cannot dodge the check", async () => {
    findFirst.mockResolvedValue({ id: "ev_1" });
    expect(await ownedId("event", BIZ, "  ev_1  ")).toBe("ev_1");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ev_1", businessId: BIZ } }),
    );
  });

  it("names the model in the error, so the message is useful", async () => {
    findFirst.mockResolvedValue(null);
    await expect(ownedId("employee", BIZ, "e1")).rejects.toThrow(/Employee not found/);
    await expect(ownedId("ingredient", BIZ, "i1")).rejects.toThrow(/Ingredient not found/);
  });
});

describe("requiredOwnedId", () => {
  it("rejects an absent id", async () => {
    await expect(requiredOwnedId("supplier", BIZ, null)).rejects.toThrow(/Supplier is required/);
  });

  it("passes a valid one through", async () => {
    findFirst.mockResolvedValue({ id: "sup_1" });
    expect(await requiredOwnedId("supplier", BIZ, "sup_1")).toBe("sup_1");
  });
});

describe("assertAllOwned", () => {
  it("accepts a set that is entirely ours", async () => {
    findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    await expect(assertAllOwned("ingredient", BIZ, ["a", "b"])).resolves.toBeUndefined();
  });

  it("rejects the set if even one id is not ours", async () => {
    // The scoped query returns only the ones we own, so a short result is the tell.
    findMany.mockResolvedValue([{ id: "a" }]);
    await expect(assertAllOwned("ingredient", BIZ, ["a", "theirs"]))
      .rejects.toThrow(/Ingredient not found/);
  });

  it("does not say WHICH id failed — that would confirm it exists elsewhere", async () => {
    findMany.mockResolvedValue([]);
    await expect(assertAllOwned("ingredient", BIZ, ["secret_id_from_another_tenant"]))
      .rejects.toThrow(/^Ingredient not found$/);
  });

  it("de-duplicates, so a repeated id does not fail a valid set", async () => {
    findMany.mockResolvedValue([{ id: "a" }]);
    await expect(assertAllOwned("ingredient", BIZ, ["a", "a", "a"])).resolves.toBeUndefined();
  });

  it("asks in ONE query rather than one per line item", async () => {
    findMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
    await assertAllOwned("ingredient", BIZ, ["a", "b", "c"]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["a", "b", "c"] }, businessId: BIZ } }),
    );
  });

  it("does nothing for an empty set", async () => {
    await expect(assertAllOwned("ingredient", BIZ, [])).resolves.toBeUndefined();
    await expect(assertAllOwned("ingredient", BIZ, [null, undefined, ""])).resolves.toBeUndefined();
    expect(findMany).not.toHaveBeenCalled();
  });
});
