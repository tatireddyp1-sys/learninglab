import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export type DirectoryUser = { id: string; name: string };

function displayLabelForUser(u: { name: string; firstName?: string; lastName?: string; email: string }): string {
  const joined = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  const n = u.name?.trim();
  if (n) return n;
  const local = u.email?.split("@")[0];
  return local || "User";
}

/**
 * Loads the tenant user list (for “Created by”, roster pickers, etc.) with loading state.
 */
export function useUserDirectory() {
  const { user, listUsers } = useAuth();
  const [nameById, setNameById] = useState<Map<string, string>>(() => new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNameById(new Map());
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await listUsers();
        if (!cancelled) {
          setNameById(
            new Map(rows.map((r) => [String(r.id).trim(), displayLabelForUser(r)]))
          );
        }
      } catch {
        if (!cancelled) setNameById(new Map());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, listUsers]);

  const users = useMemo((): DirectoryUser[] => {
    return Array.from(nameById.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [nameById]);

  const resolveName = useMemo(
    () => (userId: string, knownName?: string | null) => {
      const id = String(userId).trim();
      const fromDirectory = nameById.get(id);
      const fromApi = knownName?.trim();
      if (fromDirectory) return fromDirectory;
      if (fromApi && fromApi !== id) return fromApi;
      return undefined;
    },
    [nameById]
  );

  return { users, nameById, loading, resolveName };
}
