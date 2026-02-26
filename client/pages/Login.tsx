import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Copy, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MFAScreen from "@/components/auth/MFAScreen";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [isMFALoading, setIsMFALoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const demoCredentials = [
    { id: "admin", email: "admin@demo.com", password: "admin123", role: "Admin" },
    { id: "teacher", email: "teacher@demo.com", password: "teacher123", role: "Teacher" },
    { id: "student", email: "student@demo.com", password: "student123", role: "Student" },
  ];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!formData.email.includes("@")) {
      setError("Please enter a valid email");
      return false;
    }
    if (!formData.password) {
      setError("Password is required");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await login(formData.email, formData.password);
      // Show MFA screen instead of immediately navigating
      setShowMFA(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFAVerify = async (code: string) => {
    setIsMFALoading(true);
    setMfaError("");
    try {
      // Simulate MFA verification - in production, verify with your backend
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify the code (in a real app, send this to your backend)
      if (code === "123456") {
        // Navigate to dashboard on successful MFA
        navigate("/");
      } else {
        setMfaError("Invalid code. Please try again.");
      }
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : "MFA verification failed");
    } finally {
      setIsMFALoading(false);
    }
  };

  const handleMFACancel = () => {
    setShowMFA(false);
    setFormData({ email: "", password: "" });
    setMfaError("");
  };

  if (showMFA) {
    return (
      <MFAScreen
        email={formData.email}
        onVerify={handleMFAVerify}
        onCancel={handleMFACancel}
        isLoading={isMFALoading}
        error={mfaError}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl text-white">Welcome Back</CardTitle>
          <CardDescription className="text-white/80">Log in to your Learning Lab account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-white">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-white">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Log In"}
            </Button>

            <p className="text-center text-sm text-white/70">
              Don't have an account?{" "}
              <Link to="/signup" className="text-primary hover:underline font-semibold">
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Demo Credentials */}
      <div className="w-full max-w-md mt-6 space-y-3">
        <div className="text-center text-sm text-white/70 mb-3">
          <p className="font-semibold text-white mb-2">Demo Credentials</p>
          <p className="text-xs">Click to copy credentials (MFA code: <span className="font-mono bg-primary/20 px-2 py-1 rounded">123456</span>)</p>
        </div>
        <div className="space-y-2">
          {demoCredentials.map((cred) => (
            <div key={cred.id} className="bg-card border border-primary/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/60">Email</p>
                  <p className="text-sm font-mono text-white truncate">{cred.email}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(cred.email, `${cred.id}-email`)}
                  className="shrink-0"
                >
                  {copiedId === `${cred.id}-email` ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/60">Password</p>
                  <p className="text-sm font-mono text-white truncate">{cred.password}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(cred.password, `${cred.id}-password`)}
                  className="shrink-0"
                >
                  {copiedId === `${cred.id}-password` ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="text-xs text-primary">Role: {cred.role}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
