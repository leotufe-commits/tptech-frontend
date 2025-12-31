import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export type User = {
  id: string;
  email: string;
  name?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Jewelry = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  phoneCountry: string;
  phoneNumber: string;
  street: string;
  number: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
};

type MeResponse = {
  user: User;
  jewelry: Jewelry | null;
};

export function useMe() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<MeResponse>("/auth/me");
      setMe(data);
    } catch (e: any) {
      setMe(null);
      setError(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // si no hay token, no tiene sentido pegarle al backend
    const token = localStorage.getItem("tptech_token");
    if (!token) {
      setLoading(false);
      setMe(null);
      return;
    }
    refresh();
  }, []);

  return { me, loading, error, refresh };
}
