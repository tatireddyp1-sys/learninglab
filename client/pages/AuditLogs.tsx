import React, { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Search, Activity } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AuditLogs() {
  const { getAuditLogs, hasRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");

  // If not admin, show access denied
  if (!hasRole("admin")) {
    return (
      <div className="container py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>You don't have permission to access this page. Admin access required.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const logs = getAuditLogs();

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const query = searchQuery.toLowerCase();
      const matchesQuery =
        log.adminName.toLowerCase().includes(query) ||
        log.targetUserName?.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.targetUserId?.includes(query);

      const matchesFilter = filterAction === "all" || log.action === filterAction;

      return matchesQuery && matchesFilter;
    });
  }, [logs, searchQuery, filterAction]);

  const uniqueActions = Array.from(new Set(logs.map((log) => log.action)));

  const getActionBadgeColor = (action: string) => {
    if (action.includes("create")) return "bg-green-500/10 text-green-600";
    if (action.includes("delete")) return "bg-red-500/10 text-red-600";
    if (action.includes("update")) return "bg-blue-500/10 text-blue-600";
    return "bg-gray-500/10 text-gray-600";
  };

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold text-white">Audit Logs</h1>
            </div>
            <p className="text-white/60 mt-1">Track all admin activities and user management actions</p>
          </div>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardHeader className="space-y-4">
            <div>
              <label htmlFor="audit-search" className="text-sm font-medium block mb-2 text-white">
                Search Logs
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 h-4 w-4" />
                <Input
                  id="audit-search"
                  placeholder="Search by admin name, target user, or action..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2 text-white">Filter by Action</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filterAction === "all" ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setFilterAction("all")}
                >
                  All Actions
                </Button>
                {uniqueActions.map((action) => (
                  <Button
                    key={action}
                    variant={filterAction === action ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setFilterAction(action)}
                  >
                    {action.replace(/_/g, " ")}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Audit Logs Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-primary/30 bg-primary/5">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Timestamp</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Admin</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Action</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Target User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-white/60">
                      {logs.length === 0 ? "No audit logs yet" : "No logs match your search"}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-primary/10 hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4 text-xs text-white whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-white">{log.adminName}</td>
                      <td className="px-6 py-4">
                        <Badge className={getActionBadgeColor(log.action)}>
                          {log.action.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-white/80">{log.targetUserName || "—"}</td>
                      <td className="px-6 py-4 text-xs text-white/60">
                        {Object.keys(log.details).length > 0 ? (
                          <div className="space-y-1">
                            {Object.entries(log.details).map(([key, value]) => (
                              <div key={key}>
                                <span className="font-medium">{key}:</span> {String(value)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Log Count */}
        <div className="text-sm text-white/60">
          Showing {filteredLogs.length} of {logs.length} logs
        </div>
      </div>
    </div>
  );
}
