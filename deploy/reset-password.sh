#!/usr/bin/env bash
# Reset any account's password (and re-activate it) from the server, e.g. a forgotten
# admin password:   sudo deploy/reset-password.sh you@example.com 'NewPassword123'
set -euo pipefail
if [[ $# -ne 2 || ${#2} -lt 8 ]]; then
  echo "Usage: sudo deploy/reset-password.sh <email> <new-password (min 8 chars)>"; exit 1
fi
cd "$(dirname "${BASH_SOURCE[0]}")/.."
docker compose -f docker-compose.prod.yml exec -T -e RESET_EMAIL="$1" -e RESET_PASSWORD="$2" api node -e '
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const email = process.env.RESET_EMAIL.toLowerCase();
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user) { console.error("No account with email " + email); process.exit(1); }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(process.env.RESET_PASSWORD, 12), isActive: true },
  });
  console.log("Password reset for " + user.email + (user.isAdmin ? " (admin)" : ""));
  await prisma.$disconnect();
})();
'
