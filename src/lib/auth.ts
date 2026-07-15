import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ensureSchema, getDb } from "@/db";
import { organizations, users } from "@/db/schema";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        await ensureSchema();
        const db = await getDb();
        const [row] = await db
          .select({
            user: users,
            orgActive: organizations.active,
          })
          .from(users)
          .innerJoin(organizations, eq(users.organizationId, organizations.id))
          .where(eq(users.email, parsed.data.email.toLowerCase()))
          .limit(1);

        if (!row) return null;
        if (!row.user.active || !row.orgActive) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          row.user.passwordHash,
        );
        if (!valid) return null;

        return {
          id: row.user.id,
          email: row.user.email,
          name: row.user.name,
          organizationId: row.user.organizationId,
          role: row.user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.organizationId = (
          user as { organizationId?: string }
        ).organizationId;
        token.role = (user as { role?: string }).role;
        return token;
      }

      // Refresca rol/activo (p. ej. tras migración a super_admin o desactivación)
      if (token.id) {
        try {
          await ensureSchema();
          const db = await getDb();
          const [row] = await db
            .select({
              role: users.role,
              organizationId: users.organizationId,
              userActive: users.active,
              orgActive: organizations.active,
            })
            .from(users)
            .innerJoin(
              organizations,
              eq(users.organizationId, organizations.id),
            )
            .where(eq(users.id, token.id as string))
            .limit(1);

          if (!row || !row.userActive || !row.orgActive) {
            token.role = "disabled";
            return token;
          }
          token.role = row.role;
          token.organizationId = row.organizationId;
        } catch {
          /* keep previous token on transient DB errors */
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.organizationId = token.organizationId as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
