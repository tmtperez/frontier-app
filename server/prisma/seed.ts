// server/prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function seedUsers() {
  // Skip gracefully if the project doesn't have a User model compiled
  const hasUserDelegate = (prisma as any).user?.upsert
  if (!hasUserDelegate) {
    console.log('User model not present; skipping user seed.')
    return
  }

  // Primary company owner (ADMIN)
  const adminEmail = 'owner@barfield.com'
  const adminPass = 'ChangeMe123!'

  // Always ensure the owner exists (don't change password unless you want to)
  await (prisma as any).user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Company Owner',
      role: 'ADMIN', // works for enum or string
      // If you want the seed to reset the password each run, uncomment:
      // passwordHash: await bcrypt.hash(adminPass, 12),
    },
    create: {
      email: adminEmail,
      name: 'Company Owner',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(adminPass, 12),
    },
  })
  console.log('Admin user ensured:', adminEmail)

  // Demo users for other roles
  const demoUsers: Array<{ email: string; name: string; role: string; password: string }> = [
    { email: 'manager@demo.local',   name: 'Manager',   role: 'MANAGER',   password: 'Manager#Pass2025' },
    { email: 'estimator@demo.local', name: 'Estimator', role: 'ESTIMATOR', password: 'Estimator#Pass2025' },
    { email: 'viewer@demo.local',    name: 'Viewer',    role: 'VIEWER',    password: 'Viewer#Pass2025' },
  ]

  for (const u of demoUsers) {
    await (prisma as any).user.upsert({
      where: { email: u.email },
      // Update keeps accounts fresh on reseed (including password)
      update: {
        name: u.name,
        role: u.role,
        passwordHash: await bcrypt.hash(u.password, 12),
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: await bcrypt.hash(u.password, 12),
      },
    })
    console.log('User ensured:', u.email, `(${u.role})`)
  }
}

async function main() {
  console.log('Seeding with DB:', process.env.DATABASE_URL)

  // --- Clean up (order matters due to FKs) ---
  await prisma.bidTag.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.note.deleteMany()
  await prisma.scope.deleteMany()
  await prisma.bid.deleteMany()
  await prisma.contact.deleteMany()
  await prisma.company.deleteMany()

  // --- Companies ---
  const mega = await prisma.company.create({ data: { name: 'MegaCorp' } })
  const luxury = await prisma.company.create({ data: { name: 'Luxury Living' } })
  const shopmart = await prisma.company.create({ data: { name: 'ShopMart' } })
  const innovate = await prisma.company.create({ data: { name: 'Innovate Builders' } })

  // --- Contacts ---
  const john = await prisma.contact.create({
    data: { name: 'John Doe', email: 'john.doe@megacorp.com', phone: '555-1234', companyId: mega.id },
  })
  const jane = await prisma.contact.create({
    data: { name: 'Jane Smith', email: 'jane.smith@shopmart.com', phone: '555-5678', companyId: shopmart.id },
  })
  const peter = await prisma.contact.create({
    data: { name: 'Peter Jones', email: 'peter.jones@luxliving.com', phone: '555-9012', companyId: luxury.id },
  })

  // --- Scope Catalog ---
  const defaults = [
    'Architectural Aluminum','Canopies','Awnings','Pergola','Trellis','Arbor','Shutters',
    'Cabana','String Light Poles','Pool LSE','Balcony Rail','Screen','Perimeter Fence',
    'Retaining Wall Rail','ADA Rail','Pool Fence','Dog Park Fence','Wood Fence','Welded Wire Fence',
    'Cable Rail','Pedestrian Gates','Breezeway Gates','Entry Gates','Compactor Gates','Compactor Rail',
    'Pool Gates','Dog Park Gates','Glass Fence','Glass Gates','Chain Link Fence','PVC Fence',
  ]
  for (const name of defaults) {
    await prisma.scopeCatalog.upsert({
      where: { name },
      update: {},
      create: { name, defaultCost: null },
    })
  }

  // --- Bids with scopes ---
  const b1 = await prisma.bid.create({
    data: {
      projectName: 'Downtown Office Complex',
      clientCompanyId: mega.id,
      contactId: john.id,
      proposalDate: new Date('2025-07-10'),
      dueDate: new Date('2025-07-25'),
      jobLocation: 'Metropolis, USA',
      leadSource: 'Referral',
      bidStatus: 'Active',
      scopes: {
        create: [
          { name: 'Foundation & Concrete', cost: 350000, status: 'Pending' },
          { name: 'Structural Steel', cost: 500000, status: 'Pending' },
        ],
      },
    },
  })

  const b2 = await prisma.bid.create({
    data: {
      projectName: 'Residential Tower Foundation',
      clientCompanyId: luxury.id,
      contactId: peter.id,
      proposalDate: new Date('2025-05-10'),
      dueDate: new Date('2025-06-20'),
      jobLocation: 'Gotham, USA',
      leadSource: 'Website',
      bidStatus: 'Active',
      scopes: {
        create: [
          { name: 'Excavation', cost: 300000, status: 'Won' },
          { name: 'Reinforced Concrete', cost: 2200000, status: 'Pending' },
        ],
      },
    },
  })

  const b3 = await prisma.bid.create({
    data: {
      projectName: 'Mall Expansion Phase 2',
      clientCompanyId: shopmart.id,
      contactId: jane.id,
      proposalDate: new Date('2025-02-02'),
      dueDate: new Date('2025-02-28'),
      jobLocation: 'Star City, USA',
      leadSource: 'Cold Outreach',
      bidStatus: 'Complete',
      scopes: {
        create: [
          { name: 'Structural Steel', cost: 800000, status: 'Won' },
          { name: 'Foundation & Concrete', cost: 400000, status: 'Lost' },
        ],
      },
    },
  })

  // --- Tags ---
  const fast = await prisma.tag.create({ data: { name: 'fast-track' } })
  const gov  = await prisma.tag.create({ data: { name: 'government' } })
  await prisma.bidTag.create({ data: { bidId: b1.id, tagId: fast.id } })
  await prisma.bidTag.create({ data: { bidId: b2.id, tagId: gov.id } })

  // --- Users (ADMIN + demo roles) ---
  await seedUsers()

  console.log('Seed complete ✅')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
