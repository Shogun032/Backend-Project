import { Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { isEmail } from 'class-validator';

const prisma = new PrismaClient();
class AdminInputError extends Error {}

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || name.length > 100) {
    throw new AdminInputError('ADMIN_NAME must contain 1–100 characters');
  }

  if (!email || !isEmail(email) || email.length > 254) {
    throw new AdminInputError(
      'ADMIN_EMAIL must be a valid email of at most 254 characters',
    );
  }

  if (!password || password.length < 8 || password.length > 128) {
    throw new AdminInputError('ADMIN_PASSWORD must contain 8–128 characters');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.error('Email already exists. No account was changed.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await argon2.hash(password);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log('Admin created successfully');
}

main()
  .catch((error: unknown) => {
    if (error instanceof AdminInputError) {
      console.error(error.message);
    } else if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      console.error('Email already exists. No account was changed.');
    } else {
      console.error(
        'Admin creation failed. Check database connection and migrations.',
      );
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
