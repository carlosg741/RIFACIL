"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createClient,
  setClientActive,
  updateClient,
} from "@/lib/actions/admin";

export type ClientRow = {
  userId: string;
  email: string;
  contactName: string;
  userActive: boolean;
  createdAt: Date;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  orgActive: boolean;
};

export function ClientsManager({ clients }: { clients: ClientRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOrg, setEditOrg] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  function resetCreate() {
    setOrgName("");
    setContactName("");
    setEmail("");
    setPassword("");
  }

  function startEdit(c: ClientRow) {
    setEditingId(c.userId);
    setEditOrg(c.organizationName);
    setEditContact(c.contactName);
    setEditEmail(c.email);
    setEditPassword("");
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        {clients.length === 0 && (
          <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            Aún no hay cuentas de cliente. Crea la primera abajo.
          </p>
        )}
        {clients.map((c) => {
          const active = c.userActive && c.orgActive;
          const isEditing = editingId === c.userId;
          return (
            <div key={c.userId} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-primary">
                    {c.organizationName}{" "}
                    {!active && (
                      <span className="text-xs font-normal text-muted-foreground">
                        (inactiva)
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {c.contactName} · {c.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Org: {c.organizationSlug}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      isEditing ? setEditingId(null) : startEdit(c)
                    }
                  >
                    {isEditing ? "Cancelar" : "Editar"}
                  </Button>
                  <Button
                    size="sm"
                    variant={active ? "secondary" : "default"}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await setClientActive(c.userId, !active);
                        if (!res.ok) toast.error(res.error);
                        else {
                          toast.success(
                            active ? "Cuenta desactivada" : "Cuenta activada",
                          );
                          router.refresh();
                        }
                      })
                    }
                  >
                    {active ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              </div>

              {isEditing && (
                <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nombre de la organización</Label>
                    <Input
                      value={editOrg}
                      onChange={(e) => setEditOrg(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre de contacto</Label>
                    <Input
                      value={editContact}
                      onChange={(e) => setEditContact(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nueva contraseña (opcional)</Label>
                    <Input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Dejar vacío para no cambiar"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      disabled={pending || !editOrg || !editContact || !editEmail}
                      onClick={() =>
                        start(async () => {
                          const res = await updateClient(c.userId, {
                            organizationName: editOrg,
                            contactName: editContact,
                            email: editEmail,
                            password: editPassword || undefined,
                          });
                          if (!res.ok) toast.error(res.error);
                          else {
                            toast.success("Cliente actualizado");
                            setEditingId(null);
                            router.refresh();
                          }
                        })
                      }
                    >
                      Guardar cambios
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="max-w-lg space-y-4 rounded-xl border bg-card p-6">
        <h2 className="font-semibold text-primary">Crear cuenta de cliente</h2>
        <p className="text-sm text-muted-foreground">
          Cada cliente tiene su propia organización y panel (rifas, órdenes,
          pagos). No puede usar la rifa demo de la landing.
        </p>
        <div className="space-y-2">
          <Label>Nombre de la organización / negocio</Label>
          <Input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Ej. Rifas Aleida"
          />
        </div>
        <div className="space-y-2">
          <Label>Nombre de contacto</Label>
          <Input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Nombre de la persona"
          />
        </div>
        <div className="space-y-2">
          <Label>Email de acceso</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@correo.com"
          />
        </div>
        <div className="space-y-2">
          <Label>Contraseña temporal</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
          />
        </div>
        <Button
          disabled={
            pending || !orgName || !contactName || !email || password.length < 6
          }
          onClick={() =>
            start(async () => {
              const res = await createClient({
                organizationName: orgName,
                contactName,
                email,
                password,
              });
              if (!res.ok) toast.error(res.error);
              else {
                toast.success("Cuenta de cliente creada");
                resetCreate();
                router.refresh();
              }
            })
          }
        >
          Crear cliente
        </Button>
      </div>
    </div>
  );
}
