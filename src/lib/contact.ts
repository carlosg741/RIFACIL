export const CONTACT_EMAIL = "infomatichain@gmail.com";
export const CONTACT_WHATSAPP = "+51910603450";
export const CONTACT_WHATSAPP_DIGITS = "51910603450";

export const ORGANIZER_REQUEST_MESSAGE =
  "Hola, quiero solicitar mi panel organizador en Rifacil.";

export const ORGANIZER_SUPPORT_MESSAGE =
  "Hola, soy organizador de Rifacil y necesito soporte con mi panel.";

export function contactMailto() {
  const subject = encodeURIComponent("Solicitud de panel organizador — Rifacil");
  const body = encodeURIComponent(
    "Hola,\n\nQuiero solicitar mi panel organizador en Rifacil.\n\nNombre:\nNegocio / organización:\n",
  );
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

export function contactWhatsAppUrl(text = ORGANIZER_REQUEST_MESSAGE) {
  return `https://wa.me/${CONTACT_WHATSAPP_DIGITS}?text=${encodeURIComponent(text)}`;
}
