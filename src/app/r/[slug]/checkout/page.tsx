import { redirect } from "next/navigation";

/** Checkout vive en la página del talonario (paso integrado). */
export default async function CheckoutRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/r/${slug}`);
}
