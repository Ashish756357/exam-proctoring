import { FormEvent, useState } from "react";
import { api, LoginResponse } from "../api/client";

type Props = {
  onLoggedIn: (auth: LoginResponse) => void;
};

export const LoginPage = ({ onLoggedIn }: Props) => {
  const [email, setEmail] = useState("candidate@example.com");
  const [password, setPassword] = useState("CandidatePass!123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const auth = await api.login(email, password);
      onLoggedIn(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="layout center">
      <section className="card login-card">
        <h1>Protected Exam Portal</h1>
        <p>Secure exam entry with proctoring controls enabled.</p>

        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
};
