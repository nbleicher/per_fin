import {
  AccountSubtype,
  OwnerType,
  PrismaClient,
  TransactionSource,
  TransactionType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.transaction.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.account.deleteMany();
  await prisma.portfolioSnapshot.deleteMany();
  await prisma.portfolioCategory.deleteMany();
  await prisma.dividend.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.holding.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.strategyItem.deleteMany();
  await prisma.budgetAllocationItem.deleteMany();
  await prisma.budgetAllocationBatch.deleteMany();

  const [checking, savings, credit, loan, investment] = await Promise.all([
    prisma.account.create({
      data: {
        name: "NFCU Checking",
        ownerType: OwnerType.PERSONAL,
        accountSubtype: AccountSubtype.CHECKING,
      },
    }),
    prisma.account.create({
      data: {
        name: "NFCU Savings",
        ownerType: OwnerType.PERSONAL,
        accountSubtype: AccountSubtype.SAVINGS,
      },
    }),
    prisma.account.create({
      data: {
        name: "NFCU Visa",
        ownerType: OwnerType.PERSONAL,
        accountSubtype: AccountSubtype.CREDIT,
        limitAmount: 3000,
        annualRatePercent: 24.99,
      },
    }),
    prisma.account.create({
      data: {
        name: "Nelnet Student Loan",
        ownerType: OwnerType.PERSONAL,
        accountSubtype: AccountSubtype.LOAN,
        annualRatePercent: 5.5,
      },
    }),
    prisma.account.create({
      data: {
        name: "Fidelity CMA",
        ownerType: OwnerType.PERSONAL,
        accountSubtype: AccountSubtype.INVESTMENT,
      },
    }),
  ]);

  await prisma.bill.createMany({
    data: [
      {
        name: "Rent",
        defaultAmount: 1800,
        dueDay: 1,
        dueGroup: "first",
        defaultFromAccountId: checking.id,
      },
      {
        name: "Internet",
        defaultAmount: 80,
        dueDay: 14,
        dueGroup: "fourteenth",
        defaultFromAccountId: checking.id,
      },
    ],
  });

  const now = new Date();
  const ym = now.toISOString().slice(0, 7);
  await prisma.transaction.createMany({
    data: [
      {
        date: now,
        yearMonth: ym,
        description: "Weekly paycheck",
        amount: 1500,
        type: TransactionType.INCOME,
        source: TransactionSource.MANUAL,
        toAccountId: checking.id,
      },
      {
        date: now,
        yearMonth: ym,
        description: "Credit card payment",
        amount: 250,
        type: TransactionType.TRANSFER,
        source: TransactionSource.BILL_PAYMENT,
        fromAccountId: checking.id,
        toAccountId: credit.id,
      },
      {
        date: now,
        yearMonth: ym,
        description: "Loan payment",
        amount: 200,
        type: TransactionType.TRANSFER,
        source: TransactionSource.BILL_PAYMENT,
        fromAccountId: checking.id,
        toAccountId: loan.id,
      },
      {
        date: now,
        yearMonth: ym,
        description: "Investment contribution",
        amount: 300,
        type: TransactionType.TRANSFER,
        source: TransactionSource.ALLOCATION,
        fromAccountId: checking.id,
        toAccountId: investment.id,
      },
      {
        date: now,
        yearMonth: ym,
        description: "Emergency fund contribution",
        amount: 200,
        type: TransactionType.TRANSFER,
        source: TransactionSource.ALLOCATION,
        fromAccountId: checking.id,
        toAccountId: savings.id,
      },
    ],
  });

  await prisma.fireSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      currentAge: 29,
      annualSpending: 60000,
      expectedReturnPct: 7,
      inflationPct: 2.5,
      swrPct: 4,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
