# Rifacil

Talonario digital para organizar rifas: selección de números, pagos manuales (Yape, Plin, transferencia) con comprobante, ticket digital, link/QR para compartir y sorteo transparente.

## Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Estilo visual inspirado en Binance (amarillo `#FCD535`, canvas oscuro, IBM Plex)
- Drizzle ORM · PGlite local · Neon en producción
- Auth.js (admin)
- Comprobantes: Vercel Blob (prod) o `public/uploads/` (local)

## Arranque local

```bash
cp .env.example .env.local
# AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")

npm install
npm run db:seed
npm run dev
```

| Recurso | Valor |
|---------|--------|
| Demo | `/r/demo` |
| Admin | `/login` → `/admin` |
| Email | `admin@rifacil.com` |
| Contraseña | `rifacil123` |

## Flujo

1. Crea una rifa → en el detalle obtienes **link + QR** para WhatsApp
2. Participante elige números, paga y sube comprobante
3. Ve / descarga su **ticket digital** en `/r/[slug]/ticket/[orderId]` (sin depender del correo)
4. En **Admin → Órdenes** apruebas el pago y puedes **enviar el ticket por WhatsApp**
5. Cuando toque, lanzas el sorteo

## Tipografía y marca

- Logo: `public/rifacil-logo.jpeg`
- Colores Binance: fondo `#0B0E11`, amarillo `#FCD535`, tinta `#181A20`
- Fuentes: IBM Plex Sans / Mono (sustitutos abiertos de BinanceNova / BinancePlex)

## Deploy en Vercel

1. Sube el repo a GitHub e importa en [vercel.com](https://vercel.com)
2. Añade integración **Neon** (o pega `DATABASE_URL`)
3. Variables de entorno:
   - `AUTH_SECRET` (obligatorio)
   - `DATABASE_URL` (Neon)
   - `BLOB_READ_WRITE_TOKEN` (Blob Store — para comprobantes)
   - `NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app`
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` (solo si corres seed en prod)
4. Tras el primer deploy, con `DATABASE_URL` configurada:

```bash
npm run db:push
npm run db:seed
```

O desde tu máquina apuntando a Neon con esas env vars.

5. Redeploy. Abre `https://tu-dominio.vercel.app/login`
