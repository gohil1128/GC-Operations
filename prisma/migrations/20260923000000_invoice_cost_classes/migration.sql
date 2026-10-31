-- Which supplier-invoice categories a business books as operating expense
-- rather than cost of goods. Everything used to go into COGS, including rent,
-- marketing and equipment, which understated gross margin.
--
-- The default is applied to existing rows as well as new ones: a business that
-- has never been asked the question wants rent out of its cost of goods, and
-- leaving them on an empty list would keep every one of them wrong until
-- somebody found the setting.
ALTER TABLE "Business"
  ADD COLUMN "opexInvoiceCategories" TEXT[] NOT NULL
  DEFAULT ARRAY['Rent / Venue', 'Marketing', 'Equipment & Smallwares', 'Repairs & Maintenance', 'Cleaning']::TEXT[];
