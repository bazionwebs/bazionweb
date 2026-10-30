/**
 * Utility script to create or promote a user to SUPER_ADMIN in the database.
 * Usage:
 *   node scripts/create-superadmin.js <email> <password> [firstName] [lastName]
 */

const path = require('path');
const fs = require('fs');

// Auto-load environment variables from apps/api/.env or root .env/.env.local
const envCandidates = [
  path.resolve(__dirname, '../apps/api/.env'),
  path.resolve(__dirname, '../.env.local'),
  path.resolve(__dirname, '../.env'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
}

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function scryptAsync(password, salt, keylen, opts) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, opts, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function main() {
  const args = process.argv.slice(2);
  const email = args[0]?.trim().toLowerCase();
  const password = args[1]?.trim();
  const firstName = args[2] || 'Super';
  const lastName = args[3] || 'Admin';

  if (!email || !password) {
    console.log('Usage: node scripts/create-superadmin.js <email> <password> [firstName] [lastName]');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters long.');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findUnique({ where: { email } });

  let user;
  if (existing) {
    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: 'SUPER_ADMIN',
        passwordHash,
        mfaEnabled: true,
        deletedAt: null,
      },
    });
    console.log(`\n Successfully PROMOTED existing user [${email}] to SUPER_ADMIN!`);
  } else {
    user = await prisma.user.create({
      data: {
        email,
        role: 'SUPER_ADMIN',
        passwordHash,
        firstName,
        lastName,
        mfaEnabled: true,
      },
    });
    console.log(`\n Successfully CREATED new SUPER_ADMIN user [${email}]!`);
  }

  console.log(`User ID:     ${user.id}`);
  console.log(`Email:       ${user.email}`);
  console.log(`Role:        ${user.role}`);
  console.log(`MFA Enabled: ${user.mfaEnabled}`);
  console.log(`\nYou can now sign in at https://bazionweb.com/admin/login with this email and password.\n`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Failed to configure SuperAdmin:', err.message);
  process.exit(1);
});
