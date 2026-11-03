/* eslint-disable no-console */
import { PrismaClient, Role, LocationKind, POStatus, ShiftStatus, MovementType, SalesSource, CountType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, subDays, startOfDay, setHours, setMinutes, format } from "date-fns";

const prisma = new PrismaClient();

// This seed creates demo accounts with a published password. It ran on every
// production build, which put owner@demo.test / demo1234 (OWNER role) into the
// live database. Refuse to run anywhere that looks like production unless
// someone opts in explicitly and knowingly.
const IS_PROD =
  process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
if (IS_PROD && process.env.ALLOW_DEMO_SEED !== "yes-i-really-mean-it") {
  console.error(
    "Refusing to seed demo data in production. This seed creates accounts with a " +
      "publicly known password. Set ALLOW_DEMO_SEED=yes-i-really-mean-it only if " +
      "you genuinely want demo accounts in this database.",
  );
  process.exit(0);
}

const SHOULD_RESET = process.env.SEED_RESET === "1";

async function reset() {
  if (!SHOULD_RESET) return;
  console.log("Resetting demo data...");
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.reportSnapshot.deleteMany(),
    prisma.timeEntry.deleteMany(),
    prisma.shift.deleteMany(),
    prisma.purchaseOrderItem.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.inventoryCountLine.deleteMany(),
    prisma.inventoryCount.deleteMany(),
    prisma.inventoryMovement.deleteMany(),
    prisma.deposit.deleteMany(),
    prisma.cashClose.deleteMany(),
    prisma.dailySales.deleteMany(),
    prisma.recipeIngredient.deleteMany(),
    prisma.recipe.deleteMany(),
    prisma.unitConversion.deleteMany(),
    prisma.ingredient.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.userLocation.deleteMany(),
    prisma.user.deleteMany(),
    prisma.location.deleteMany(),
    prisma.business.deleteMany(),
  ]);
}

function cents(d: number) { return Math.round(d * 100); }

function weekdayCurve(day: Date, base: number): number {
  // Mon..Sun => 0..6
  const d = day.getDay();
  const factor = [0.75, 0.85, 0.95, 1.15, 1.35, 1.45, 1.05][(d + 6) % 7];
  const jitter = 0.85 + Math.random() * 0.3;
  return Math.round(base * factor * jitter);
}

async function main() {
  await reset();

  // Detect existing
  let business = await prisma.business.findFirst();
  if (business) {
    // One-time rename if the old seeded name is still in place
    if (business.name === "Northwind Eats") {
      business = await prisma.business.update({
        where: { id: business.id },
        data: { name: "God's Chai Operations" },
      });
      console.log(`Renamed business to "${business.name}".`);
    } else {
      console.log(`Business already exists (${business.name}). Skipping seed. Set SEED_RESET=1 to rebuild.`);
    }
    return;
  }

  console.log("Seeding demo data...");
  business = await prisma.business.create({
    data: {
      name: "God's Chai Operations",
      // Where this business actually trades. Every business day in the app is
      // derived from it, so a wrong value files evening takings under tomorrow.
      timezone: "America/Toronto",
      currency: "CAD",
      foodTargetPct: 32,
      laborTargetPct: 30,
    },
  });

  const downtown = await prisma.location.create({
    data: { businessId: business.id, name: "Downtown Cafe", kind: LocationKind.STORE, address: "123 Main St" },
  });
  const events = await prisma.location.create({
    data: { businessId: business.id, name: "Pop-up Events", kind: LocationKind.EVENT, address: "Various" },
  });

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const owner = await prisma.user.create({
    data: { businessId: business.id, email: "owner@demo.test", passwordHash, name: "Olivia Owner", role: Role.OWNER },
  });
  const manager = await prisma.user.create({
    data: { businessId: business.id, email: "manager@demo.test", passwordHash, name: "Marco Manager", role: Role.MANAGER },
  });
  await prisma.userLocation.createMany({
    data: [
      { userId: owner.id, locationId: downtown.id },
      { userId: owner.id, locationId: events.id },
      { userId: manager.id, locationId: downtown.id },
      { userId: manager.id, locationId: events.id },
    ],
  });

  // Suppliers
  const supplierData = [
    { name: "Greenfield Produce", terms: "Net 14", leadTimeDays: 1, email: "sales@greenfield.test" },
    { name: "Dairy Direct", terms: "Net 30", leadTimeDays: 2, email: "orders@dairydirect.test" },
    { name: "Prime Meats", terms: "Net 30", leadTimeDays: 2, email: "wholesale@primemeats.test" },
    { name: "Pantry Wholesale", terms: "Net 30", leadTimeDays: 3 },
    { name: "Bayside Beverages", terms: "Net 30", leadTimeDays: 2 },
  ];
  const suppliers = await Promise.all(
    supplierData.map((s) => prisma.supplier.create({ data: { businessId: business!.id, ...s } }))
  );
  const [produce, dairy, meat, pantry, bev] = suppliers;

  // Ingredients (32)
  const ingDefs: Array<{ name: string; unit: string; cost: number; supplier: typeof produce; par: number; reorder: number; reorderQty: number; cat: string }> = [
    { name: "Romaine Lettuce", unit: "head", cost: 1.85, supplier: produce, par: 30, reorder: 12, reorderQty: 24, cat: "Produce" },
    { name: "Tomatoes", unit: "lb", cost: 1.40, supplier: produce, par: 40, reorder: 15, reorderQty: 30, cat: "Produce" },
    { name: "Yellow Onions", unit: "lb", cost: 0.80, supplier: produce, par: 25, reorder: 10, reorderQty: 25, cat: "Produce" },
    { name: "Russet Potatoes", unit: "lb", cost: 0.60, supplier: produce, par: 80, reorder: 30, reorderQty: 50, cat: "Produce" },
    { name: "Avocado", unit: "ea", cost: 1.10, supplier: produce, par: 40, reorder: 15, reorderQty: 30, cat: "Produce" },
    { name: "Cilantro", unit: "bunch", cost: 0.90, supplier: produce, par: 12, reorder: 5, reorderQty: 12, cat: "Produce" },
    { name: "Lemons", unit: "ea", cost: 0.45, supplier: produce, par: 60, reorder: 20, reorderQty: 40, cat: "Produce" },
    { name: "Whole Milk", unit: "gal", cost: 4.20, supplier: dairy, par: 12, reorder: 4, reorderQty: 8, cat: "Dairy" },
    { name: "Heavy Cream", unit: "qt", cost: 5.10, supplier: dairy, par: 8, reorder: 3, reorderQty: 6, cat: "Dairy" },
    { name: "Cheddar Cheese", unit: "lb", cost: 4.95, supplier: dairy, par: 15, reorder: 5, reorderQty: 12, cat: "Dairy" },
    { name: "Mozzarella", unit: "lb", cost: 5.25, supplier: dairy, par: 18, reorder: 6, reorderQty: 12, cat: "Dairy" },
    { name: "Butter", unit: "lb", cost: 3.95, supplier: dairy, par: 12, reorder: 4, reorderQty: 10, cat: "Dairy" },
    { name: "Eggs", unit: "doz", cost: 4.10, supplier: dairy, par: 20, reorder: 6, reorderQty: 12, cat: "Dairy" },
    { name: "Ground Beef 80/20", unit: "lb", cost: 5.95, supplier: meat, par: 30, reorder: 10, reorderQty: 25, cat: "Meat" },
    { name: "Chicken Breast", unit: "lb", cost: 4.50, supplier: meat, par: 35, reorder: 12, reorderQty: 25, cat: "Meat" },
    { name: "Bacon", unit: "lb", cost: 7.10, supplier: meat, par: 14, reorder: 5, reorderQty: 10, cat: "Meat" },
    { name: "Smoked Brisket", unit: "lb", cost: 9.85, supplier: meat, par: 10, reorder: 4, reorderQty: 8, cat: "Meat" },
    { name: "Sourdough Bread", unit: "loaf", cost: 3.50, supplier: pantry, par: 14, reorder: 6, reorderQty: 12, cat: "Bakery" },
    { name: "Burger Buns", unit: "ea", cost: 0.55, supplier: pantry, par: 120, reorder: 40, reorderQty: 100, cat: "Bakery" },
    { name: "Tortillas", unit: "ea", cost: 0.25, supplier: pantry, par: 200, reorder: 60, reorderQty: 150, cat: "Bakery" },
    { name: "Olive Oil", unit: "L", cost: 9.20, supplier: pantry, par: 6, reorder: 2, reorderQty: 4, cat: "Pantry" },
    { name: "Sea Salt", unit: "lb", cost: 1.80, supplier: pantry, par: 8, reorder: 3, reorderQty: 5, cat: "Pantry" },
    { name: "Black Pepper", unit: "lb", cost: 11.50, supplier: pantry, par: 3, reorder: 1, reorderQty: 2, cat: "Pantry" },
    { name: "Sugar", unit: "lb", cost: 0.95, supplier: pantry, par: 20, reorder: 6, reorderQty: 15, cat: "Pantry" },
    { name: "All-Purpose Flour", unit: "lb", cost: 0.85, supplier: pantry, par: 40, reorder: 12, reorderQty: 25, cat: "Pantry" },
    { name: "Espresso Beans", unit: "lb", cost: 14.50, supplier: bev, par: 18, reorder: 6, reorderQty: 12, cat: "Beverage" },
    { name: "Tea Bags Black", unit: "ea", cost: 0.10, supplier: bev, par: 500, reorder: 200, reorderQty: 500, cat: "Beverage" },
    { name: "Cola Syrup", unit: "gal", cost: 38.00, supplier: bev, par: 4, reorder: 2, reorderQty: 4, cat: "Beverage" },
    { name: "Orange Juice", unit: "gal", cost: 7.40, supplier: bev, par: 6, reorder: 2, reorderQty: 4, cat: "Beverage" },
    { name: "Sparkling Water", unit: "ea", cost: 0.75, supplier: bev, par: 96, reorder: 36, reorderQty: 72, cat: "Beverage" },
    { name: "Almond Milk", unit: "qt", cost: 3.80, supplier: dairy, par: 8, reorder: 3, reorderQty: 6, cat: "Dairy" },
    { name: "Garlic", unit: "lb", cost: 5.20, supplier: produce, par: 6, reorder: 2, reorderQty: 4, cat: "Produce" },
  ];

  const ingredients = await Promise.all(
    ingDefs.map((d) =>
      prisma.ingredient.create({
        data: {
          businessId: business!.id,
          name: d.name,
          category: d.cat,
          unit: d.unit,
          parLevel: d.par,
          reorderPoint: d.reorder,
          reorderQty: d.reorderQty,
          lastCostCents: cents(d.cost),
          avgCostCents: cents(d.cost),
          supplierId: d.supplier.id,
          // start on-hand near par; we'll adjust 6 of them below reorder
          onHand: d.par * 0.7,
        },
      })
    )
  );

  // Drive 6 items below reorder point
  for (let i = 0; i < 6; i++) {
    await prisma.ingredient.update({ where: { id: ingredients[i].id }, data: { onHand: ingredients[i].reorderPoint * 0.6 } });
  }

  // Recipes (10)
  const recipes = [
    { name: "Classic Cheeseburger", price: 13.95, cat: "Mains", items: [
      { ing: "Ground Beef 80/20", qty: 0.33, unit: "lb" },
      { ing: "Burger Buns", qty: 1, unit: "ea" },
      { ing: "Cheddar Cheese", qty: 0.1, unit: "lb" },
      { ing: "Tomatoes", qty: 0.1, unit: "lb" },
      { ing: "Romaine Lettuce", qty: 0.1, unit: "head" },
      { ing: "Yellow Onions", qty: 0.05, unit: "lb" },
    ]},
    { name: "Chicken Caesar Salad", price: 12.50, cat: "Mains", items: [
      { ing: "Chicken Breast", qty: 0.4, unit: "lb" },
      { ing: "Romaine Lettuce", qty: 0.8, unit: "head" },
      { ing: "Olive Oil", qty: 0.03, unit: "L" },
      { ing: "Lemons", qty: 0.3, unit: "ea" },
    ]},
    { name: "Truffle Fries", price: 7.50, cat: "Sides", items: [
      { ing: "Russet Potatoes", qty: 0.5, unit: "lb" },
      { ing: "Olive Oil", qty: 0.04, unit: "L" },
      { ing: "Sea Salt", qty: 0.01, unit: "lb" },
    ]},
    { name: "Avocado Toast", price: 9.95, cat: "Brunch", items: [
      { ing: "Sourdough Bread", qty: 0.25, unit: "loaf" },
      { ing: "Avocado", qty: 1, unit: "ea" },
      { ing: "Lemons", qty: 0.25, unit: "ea" },
      { ing: "Sea Salt", qty: 0.005, unit: "lb" },
    ]},
    { name: "Brisket Tacos", price: 14.25, cat: "Mains", items: [
      { ing: "Smoked Brisket", qty: 0.3, unit: "lb" },
      { ing: "Tortillas", qty: 3, unit: "ea" },
      { ing: "Cilantro", qty: 0.1, unit: "bunch" },
      { ing: "Yellow Onions", qty: 0.05, unit: "lb" },
    ]},
    { name: "Margherita Pizza", price: 14.95, cat: "Mains", items: [
      { ing: "All-Purpose Flour", qty: 0.4, unit: "lb" },
      { ing: "Mozzarella", qty: 0.25, unit: "lb" },
      { ing: "Tomatoes", qty: 0.3, unit: "lb" },
      { ing: "Olive Oil", qty: 0.02, unit: "L" },
    ]},
    { name: "Latte", price: 4.95, cat: "Drinks", items: [
      { ing: "Espresso Beans", qty: 0.02, unit: "lb" },
      { ing: "Whole Milk", qty: 0.04, unit: "gal" },
    ]},
    { name: "Iced Tea", price: 3.50, cat: "Drinks", items: [
      { ing: "Tea Bags Black", qty: 1, unit: "ea" },
      { ing: "Sugar", qty: 0.05, unit: "lb" },
    ]},
    { name: "Pancakes", price: 9.50, cat: "Brunch", items: [
      { ing: "All-Purpose Flour", qty: 0.3, unit: "lb" },
      { ing: "Eggs", qty: 0.16, unit: "doz" }, // 2 eggs
      { ing: "Whole Milk", qty: 0.05, unit: "gal" },
      { ing: "Butter", qty: 0.04, unit: "lb" },
      { ing: "Sugar", qty: 0.03, unit: "lb" },
    ]},
    { name: "BLT Sandwich", price: 11.25, cat: "Mains", items: [
      { ing: "Sourdough Bread", qty: 0.2, unit: "loaf" },
      { ing: "Bacon", qty: 0.2, unit: "lb" },
      { ing: "Romaine Lettuce", qty: 0.1, unit: "head" },
      { ing: "Tomatoes", qty: 0.1, unit: "lb" },
    ]},
  ];

  const ingByName = new Map(ingredients.map((i) => [i.name, i]));
  const recipeRecords = [] as Awaited<ReturnType<typeof prisma.recipe.create>>[];
  for (const r of recipes) {
    const created = await prisma.recipe.create({
      data: {
        businessId: business!.id,
        name: r.name,
        category: r.cat,
        menuPriceCents: cents(r.price),
        yieldQty: 1,
        yieldUnit: "ea",
        isActive: true,
        ingredients: {
          create: r.items
            .map((it) => {
              const ing = ingByName.get(it.ing);
              if (!ing) return null;
              return { ingredientId: ing.id, qty: it.qty, unit: it.unit };
            })
            .filter(Boolean) as { ingredientId: string; qty: number; unit: string }[],
        },
      },
    });
    recipeRecords.push(created);
  }

  // Employees
  const employees = await Promise.all(
    [
      { name: "Aisha Cook", position: "Lead Cook", rate: 22.00 },
      { name: "Brian Cook", position: "Line Cook", rate: 18.50 },
      { name: "Carla Server", position: "Server", rate: 14.00 },
      { name: "Daniel Server", position: "Server", rate: 14.00 },
      { name: "Eva Barista", position: "Barista", rate: 16.50 },
      { name: "Frank Cashier", position: "Cashier", rate: 15.00 },
      { name: "Grace Cook", position: "Prep Cook", rate: 17.00 },
      { name: "Hugo Server", position: "Server", rate: 14.00 },
      { name: "Iris Manager", position: "Shift Lead", rate: 24.00 },
      { name: "Jay Dishwasher", position: "Dishwasher", rate: 15.50 },
    ].map((e) =>
      prisma.employee.create({
        data: {
          businessId: business!.id,
          name: e.name,
          position: e.position,
          hourlyRateCents: cents(e.rate),
          isActive: true,
          email: `${e.name.toLowerCase().split(" ")[0]}@demo.test`,
        },
      })
    )
  );

  // Daily sales 45 days × 2 locations
  const today = startOfDay(new Date());
  const recipeMix = recipeRecords.map((r, i) => ({ recipeId: r.id, weight: 0.18 - i * 0.013 + Math.random() * 0.03 }));
  const totalWeight = recipeMix.reduce((a, m) => a + Math.max(m.weight, 0.02), 0);
  const normalized = recipeMix.map((m) => ({ recipeId: m.recipeId, p: Math.max(m.weight, 0.02) / totalWeight }));

  for (let i = 44; i >= 0; i--) {
    const date = subDays(today, i);
    // Downtown
    const downtownGuests = weekdayCurve(date, 120);
    const downtownAOV = 14 + Math.random() * 3;
    let netDowntown = cents(downtownGuests * downtownAOV);
    // a couple outlier days
    if (i === 3) netDowntown = Math.round(netDowntown * 1.45);
    if (i === 10) netDowntown = Math.round(netDowntown * 0.55);

    await prisma.dailySales.create({
      data: {
        locationId: downtown.id,
        businessDate: date,
        netSalesCents: netDowntown,
        taxCents: Math.round(netDowntown * 0.08),
        guestCount: downtownGuests,
        source: SalesSource.MANUAL,
      },
    });

    // Pop-up Events (3 days/week only)
    if ([4, 5, 6].includes(date.getDay())) {
      const eventGuests = weekdayCurve(date, 60);
      const netEvents = cents(eventGuests * (16 + Math.random() * 2));
      await prisma.dailySales.create({
        data: {
          locationId: events.id,
          businessDate: date,
          netSalesCents: netEvents,
          taxCents: Math.round(netEvents * 0.08),
          guestCount: eventGuests,
          source: SalesSource.MANUAL,
        },
      });
    }
  }

  // Inventory movements: purchases ~weekly, usage daily
  // Generate USAGE for each day based on sales × recipe mix
  const ingFullById = new Map(ingredients.map((i) => [i.id, i]));
  // Pre-fetch recipe ingredients
  const recipesWithIng = await prisma.recipe.findMany({
    where: { businessId: business.id },
    include: { ingredients: true },
  });
  const recipeMap = new Map(recipesWithIng.map((r) => [r.id, r]));

  for (let i = 44; i >= 0; i--) {
    const date = subDays(today, i);
    // Downtown
    const downtownSale = await prisma.dailySales.findFirst({ where: { locationId: downtown.id, businessDate: date } });
    if (downtownSale) {
      const totalCovers = downtownSale.guestCount;
      for (const m of normalized) {
        const recipe = recipeMap.get(m.recipeId)!;
        const orders = Math.round(totalCovers * m.p);
        if (orders <= 0) continue;
        for (const ri of recipe.ingredients) {
          const ing = ingFullById.get(ri.ingredientId)!;
          await prisma.inventoryMovement.create({
            data: {
              locationId: downtown.id,
              ingredientId: ing.id,
              type: MovementType.USAGE,
              qty: -ri.qty * orders,
              unit: ri.unit,
              unitCostCents: ing.avgCostCents,
              occurredAt: setHours(date, 20),
              sourceType: "SALE",
              note: `${orders} × ${recipe.name}`,
            },
          });
        }
      }
    }
  }

  // Sample purchase orders (8)
  const samplePoDefs = [
    { sup: produce, status: POStatus.RECEIVED, daysAgo: 12, items: ["Romaine Lettuce", "Tomatoes", "Avocado"] },
    { sup: dairy, status: POStatus.RECEIVED, daysAgo: 10, items: ["Whole Milk", "Cheddar Cheese", "Butter"] },
    { sup: meat, status: POStatus.RECEIVED, daysAgo: 9, items: ["Ground Beef 80/20", "Chicken Breast", "Bacon"] },
    { sup: pantry, status: POStatus.RECEIVED, daysAgo: 7, items: ["All-Purpose Flour", "Olive Oil", "Sea Salt"] },
    { sup: bev, status: POStatus.RECEIVED, daysAgo: 5, items: ["Espresso Beans", "Sparkling Water"] },
    { sup: produce, status: POStatus.SENT, daysAgo: 1, items: ["Tomatoes", "Yellow Onions", "Lemons"] },
    { sup: meat, status: POStatus.DRAFT, daysAgo: 0, items: ["Smoked Brisket", "Bacon"] },
    { sup: dairy, status: POStatus.SENT, daysAgo: 0, items: ["Heavy Cream", "Mozzarella"] },
  ];

  for (const def of samplePoDefs) {
    const orderedAt = subDays(today, def.daysAgo);
    const expectedAt = addDays(orderedAt, def.sup.leadTimeDays);
    const itemDefs = def.items
      .map((name) => ingByName.get(name))
      .filter(Boolean)
      .map((i) => ({
        ingredientId: i!.id,
        qtyOrdered: i!.reorderQty || 10,
        unit: i!.unit,
        unitCostCents: i!.lastCostCents,
        lineTotalCents: Math.round((i!.reorderQty || 10) * i!.lastCostCents),
      }));
    const subtotalCents = itemDefs.reduce((a, it) => a + it.lineTotalCents, 0);
    const po = await prisma.purchaseOrder.create({
      data: {
        locationId: downtown.id,
        supplierId: def.sup.id,
        status: def.status,
        orderedAt,
        expectedAt,
        receivedAt: def.status === POStatus.RECEIVED ? expectedAt : null,
        subtotalCents,
        totalCents: subtotalCents,
        notes: null,
        createdById: owner.id,
        items: {
          create: itemDefs.map((it) => ({ ...it, qtyReceived: def.status === POStatus.RECEIVED ? it.qtyOrdered : 0 })),
        },
      },
      include: { items: true },
    });

    if (def.status === POStatus.RECEIVED) {
      for (const it of po.items) {
        await prisma.inventoryMovement.create({
          data: {
            locationId: downtown.id,
            ingredientId: it.ingredientId,
            type: MovementType.PURCHASE,
            qty: it.qtyOrdered,
            unit: it.unit,
            unitCostCents: it.unitCostCents,
            occurredAt: expectedAt,
            sourceType: "PO",
            sourceId: po.id,
          },
        });
        await prisma.ingredient.update({
          where: { id: it.ingredientId },
          data: { onHand: { increment: it.qtyOrdered } },
        });
      }
    }
  }

  // Inventory counts — 6 weekly, last one shows variance
  for (let w = 5; w >= 0; w--) {
    const countedAt = subDays(today, w * 7);
    const isLatest = w === 0;
    const count = await prisma.inventoryCount.create({
      data: {
        locationId: downtown.id,
        type: CountType.WEEKLY,
        countedAt,
        countedById: manager.id,
        notes: isLatest ? "Weekly count — Friday" : "Weekly count",
      },
    });

    for (const ing of ingredients) {
      // refresh on-hand snapshot via current value
      const current = await prisma.ingredient.findUnique({ where: { id: ing.id } });
      if (!current) continue;
      const driftPct = isLatest ? (Math.random() - 0.6) * 0.06 : (Math.random() - 0.5) * 0.02; // unfavorable on latest
      const actual = Math.max(0, current.onHand * (1 + driftPct));
      const variance = actual - current.onHand;
      const varianceCostCents = Math.round(variance * current.avgCostCents);

      await prisma.inventoryCountLine.create({
        data: {
          countId: count.id,
          ingredientId: ing.id,
          qtyCounted: Number(actual.toFixed(2)),
          unit: ing.unit,
          theoreticalQty: current.onHand,
          varianceQty: variance,
          varianceCostCents,
        },
      });

      if (isLatest) {
        await prisma.inventoryMovement.create({
          data: {
            locationId: downtown.id,
            ingredientId: ing.id,
            type: MovementType.COUNT_RECONCILE,
            qty: variance,
            unit: ing.unit,
            unitCostCents: current.avgCostCents,
            occurredAt: countedAt,
            sourceType: "COUNT",
            sourceId: count.id,
          },
        });
        await prisma.ingredient.update({
          where: { id: ing.id },
          data: { onHand: Number(actual.toFixed(2)) },
        });
      }
    }
  }

  // Shifts for last 4 weeks (Mon..Sun), each day ~5 shifts
  const shiftTemplates = [
    { startH: 7, endH: 15, employee: 0, position: "Lead Cook" },
    { startH: 8, endH: 16, employee: 1, position: "Line Cook" },
    { startH: 11, endH: 21, employee: 2, position: "Server" },
    { startH: 11, endH: 19, employee: 3, position: "Server" },
    { startH: 6, endH: 14, employee: 4, position: "Barista" },
    { startH: 14, endH: 22, employee: 5, position: "Cashier" },
    { startH: 12, endH: 20, employee: 8, position: "Shift Lead" },
    { startH: 15, endH: 23, employee: 9, position: "Dishwasher" },
  ];

  for (let d = 27; d >= 0; d--) {
    const day = subDays(today, d);
    const isLatestWeek = d < 7;
    for (let i = 0; i < shiftTemplates.length; i++) {
      const t = shiftTemplates[i];
      const emp = employees[t.employee];
      const start = setMinutes(setHours(day, t.startH), 0);
      const end = setMinutes(setHours(day, t.endH), 0);
      const scheduledMinutes = (t.endH - t.startH) * 60;
      const isMissing = isLatestWeek && d === 1 && (i === 2 || i === 5); // 2 missing entries last week
      const shift = await prisma.shift.create({
        data: {
          locationId: downtown.id,
          employeeId: emp.id,
          position: t.position,
          start,
          end,
          scheduledMinutes,
          status: isMissing ? ShiftStatus.SCHEDULED : ShiftStatus.COMPLETED,
        },
      });
      if (!isMissing && d > 0) {
        const drift = Math.round((Math.random() - 0.3) * 30);
        await prisma.timeEntry.create({
          data: {
            shiftId: shift.id,
            clockIn: start,
            clockOut: end,
            actualMinutes: scheduledMinutes + drift,
            breakMinutes: 30,
          },
        });
      }
    }
  }

  // Cash closes for last 30 days (skip today)
  for (let d = 30; d >= 1; d--) {
    const date = startOfDay(subDays(today, d));
    const sales = await prisma.dailySales.findFirst({ where: { locationId: downtown.id, businessDate: date } });
    if (!sales) continue;
    const openingCents = cents(300);
    const expectedCents = openingCents + Math.round(sales.netSalesCents * 0.4);
    // most days within $5, 3 outliers
    let drift = Math.round((Math.random() - 0.5) * 1000);
    if (d === 4 || d === 12 || d === 21) drift = (Math.random() > 0.5 ? 1 : -1) * (2500 + Math.round(Math.random() * 2000));
    const closingCents = expectedCents + drift;
    const depositCents = closingCents - openingCents > 0 ? closingCents - openingCents : 0;
    const overShortCents = closingCents + depositCents - openingCents - expectedCents;
    await prisma.cashClose.create({
      data: {
        locationId: downtown.id,
        businessDate: date,
        openingCents,
        closingCents,
        safeCountCents: cents(500),
        depositCents,
        paidInCents: 0,
        paidOutCents: 0,
        expectedCents,
        overShortCents,
        closedById: manager.id,
        checklistJson: [
          { label: "Till counted with manager", done: true },
          { label: "Safe count verified", done: true },
          { label: "Deposit slip prepared", done: true },
          { label: "Reports printed", done: true },
          { label: "Drawer locked", done: true },
        ],
      },
    });
    if (depositCents > 0) {
      await prisma.deposit.create({
        data: { locationId: downtown.id, businessDate: date, amountCents: depositCents, reference: `Deposit ${format(date, "MMddyy")}` },
      });
    }
  }
  // Intentionally NO close for yesterday — drives a "missing close" exception
  // Audit log seed entries
  await prisma.auditLog.createMany({
    data: [
      { businessId: business.id, userId: owner.id, action: "seed.initial", entityType: "Business", entityId: business.id },
      { businessId: business.id, userId: manager.id, action: "count.create", entityType: "InventoryCount" },
      { businessId: business.id, userId: manager.id, action: "po.receive", entityType: "PurchaseOrder" },
    ],
  });

  console.log("Seed complete.");
  console.log("Login: owner@demo.test / demo1234  (or manager@demo.test / demo1234)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
