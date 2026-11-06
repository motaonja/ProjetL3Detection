import React, { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { login, register, type AuthUser } from "../services/api";

interface LoginViewProps {
  onAuthenticated: (user: AuthUser) => void;
  notice?: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

/* ---------- Logo RecMatch ---------- */
function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="rm-gl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0F4A2E" />
          <stop offset="1" stopColor="#1F7F55" />
        </linearGradient>
        <linearGradient id="rm-gr" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#62BE8E" />
          <stop offset="1" stopColor="#2E9B62" />
        </linearGradient>
        <clipPath id="rm-lens">
          <circle cx="24" cy="32" r="18" />
        </clipPath>
      </defs>
      <circle cx="24" cy="32" r="18" fill="url(#rm-gl)" />
      <circle cx="40" cy="32" r="18" fill="url(#rm-gr)" />
      <g clipPath="url(#rm-lens)">
        <circle cx="40" cy="32" r="18" fill="#0B3B24" />
      </g>
      <path
        d="M25.5 32 C 28.5 25.5, 35.5 25.5, 32 32 S 35.5 38.5, 38.5 32"
        fill="none"
        stroke="#E3F3EA"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ---------- Illustration : rapprochement de documents ---------- */
interface DocProps {
  x: number;
  y: number;
  rotate: number;
  bars: number[];
  matches: number[];
}

function Doc({ x, y, rotate, bars, matches }: DocProps) {
  return (
    <g transform={`rotate(${rotate} ${x + 85} ${y + 115})`} filter="url(#rm-shadow)">
      <rect x={x} y={y} width="170" height="230" rx="16" fill="#FFFFFF" />
      <circle cx={x + 26} cy={y + 28} r="10" fill="#1F7F55" />
      <rect x={x + 44} y={y + 20} width="72" height="8" rx="4" fill="#0F4A2E" />
      <rect x={x + 44} y={y + 34} width="44" height="6" rx="3" fill="#C9CFCB" />
      {bars.map((w, i) => {
        const m = matches.includes(i);
        const ry = y + 62 + i * 34;
        return (
          <g key={i}>
            <rect
              x={x + 14}
              y={ry}
              width="142"
              height="26"
              rx="9"
              fill={m ? "#E3F3EA" : "#F5F5F5"}
              stroke={m ? "#62BE8E" : "none"}
              strokeWidth="1.5"
            />
            <rect x={x + 26} y={ry + 9} width={w} height="8" rx="4" fill={m ? "#2E9B62" : "#C9CFCB"} />
          </g>
        );
      })}
    </g>
  );
}

function CheckBadge({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="17" fill="#E3F3EA" opacity=".35" />
      <circle r="11" fill="#E3F3EA" />
      <path d="M-4.5 0.5L-1.5 3.5L4.5 -3" fill="none" stroke="#1F7F55" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function Illustration() {
  return (
    <svg
      viewBox="0 0 700 580"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <clipPath id="rm-blob">
          <path d="M190 0H700V580H0C120 560 215 480 238 390C262 298 168 240 150 160C136 98 156 34 190 0Z" />
        </clipPath>
        <linearGradient id="rm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B3B24" />
          <stop offset=".6" stopColor="#14573A" />
          <stop offset="1" stopColor="#1F7F55" />
        </linearGradient>
        <radialGradient id="rm-halo">
          <stop offset="0" stopColor="#E3F3EA" stopOpacity=".5" />
          <stop offset="1" stopColor="#E3F3EA" stopOpacity="0" />
        </radialGradient>
        <filter id="rm-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="14" stdDeviation="10" floodColor="#041D10" floodOpacity=".4" />
        </filter>
      </defs>

      <g clipPath="url(#rm-blob)">
        <rect width="700" height="580" fill="url(#rm-sky)" />

        {/* deux grands cercles qui se rejoignent (rappel du logo) */}
        <circle cx="560" cy="110" r="150" fill="url(#rm-halo)" />
        <circle cx="545" cy="105" r="62" fill="#62BE8E" opacity=".28" />
        <circle cx="605" cy="105" r="62" fill="#E3F3EA" opacity=".16" />

        {/* points décoratifs */}
        <g fill="#E3F3EA" opacity=".8">
          <circle cx="300" cy="80" r="1.6" />
          <circle cx="380" cy="120" r="1.3" />
          <circle cx="450" cy="55" r="1.8" />
          <circle cx="330" cy="140" r="1.4" />
          <circle cx="690" cy="40" r="1.4" />
          <circle cx="660" cy="500" r="1.6" />
          <circle cx="290" cy="510" r="1.4" />
        </g>

        {/* document A et document B */}
        <Doc x={262} y={170} rotate={-5} bars={[96, 70, 110, 84, 60]} matches={[1, 3]} />
        <Doc x={505} y={200} rotate={5} bars={[64, 102, 76, 92, 112]} matches={[1, 3]} />

        {/* liens entre enregistrements correspondants */}
        <g fill="none" stroke="#62BE8E" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7">
          <path d="M431 272C460 272 478 302 506 302" />
          <path d="M437 339C465 339 472 369 500 369" />
        </g>
        <g fill="#E3F3EA">
          <circle cx="431" cy="272" r="4" />
          <circle cx="506" cy="302" r="4" />
          <circle cx="437" cy="339" r="4" />
          <circle cx="500" cy="369" r="4" />
        </g>
        <CheckBadge x={469} y={287} />
        <CheckBadge x={468} y={354} />

        {/* résultat */}
        <g transform="translate(335 462)">
          <rect width="236" height="48" rx="24" fill="#E3F3EA" />
          <circle cx="26" cy="24" r="13" fill="#1F7F55" />
          <path d="M20 24.5L24.5 29L32.5 19.5" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <text x="50" y="22" fontSize="13" fontWeight="700" fill="#0B3B24">Doublon détecté</text>
          <text x="50" y="37" fontSize="11" fontWeight="500" fill="#4B6B5A">98 % de similarité</text>
        </g>
      </g>
    </svg>
  );
}

/* ---------- Champ à trait simple ---------- */
interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  trailing?: React.ReactNode;
}

function Field({ label, hint, trailing, id, ...props }: FieldProps) {
  return (
    <div className="relative">
      <label htmlFor={id} className="block text-xs font-semibold text-[#1F7F55]">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className="w-full border-0 border-b-[1.5px] border-[#D9DDDB] bg-transparent py-2 pr-9 text-[15px] text-[var(--text)] outline-none transition-colors placeholder:text-[#8A8F8C]/70 focus:border-[#1F7F55]"
      />
      {trailing}
      {hint && <span className="mt-1 block text-xs text-[#8A8F8C]">{hint}</span>}
    </div>
  );
}

function EyeButton({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      className="absolute right-0 top-[22px] p-1 text-[#8A8F8C] transition-colors hover:text-[#1B6B43]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        {shown && <path d="M3 3l18 18" />}
      </svg>
    </button>
  );
}

/* ---------- Page de connexion ---------- */
export function LoginView({ onAuthenticated, notice, theme, onToggleTheme }: LoginViewProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (isRegistering && !name.trim()) {
      setError("Saisissez votre nom.");
      return;
    }
    if (isRegistering && password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      if (isRegistering) {
        await register(name.trim(), email, password, confirmPassword);
        setIsRegistering(false);
        setPassword("");
        setConfirmPassword("");
        setMessage("Compte créé. Vous pouvez maintenant vous connecter.");
      } else {
        const user = await login(email, password);
        setPassword("");
        onAuthenticated(user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  const toggleMode = () => {
    setError("");
    setMessage("");
    setIsRegistering((value) => !value);
  };

  return (
    <main
      className="relative flex min-h-screen items-center justify-center bg-[#EDEDED] p-4 text-[#111111] sm:p-6"
      style={{ fontFamily: 'inherit' }}
    >
      <button type="button" onClick={onToggleTheme} aria-label={theme === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair'} className="absolute right-5 top-5 z-10 rounded-full border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--text)]">{theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</button>
      <div className="grid min-h-[580px] w-full max-w-[1080px] overflow-hidden rounded-[32px] bg-white shadow-[0_30px_60px_-30px_rgba(11,59,36,0.35)] md:grid-cols-[minmax(320px,430px)_1fr]">
        {/* Panneau formulaire */}
        <section className="flex flex-col px-7 py-9 sm:px-12 sm:pb-9 sm:pt-12">
          <div className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-[#0B3B24]">
            <LogoMark />
            RecMatch
          </div>

          <p className="mt-12 text-[15px] font-semibold text-[#1F7F55]">
            {isRegistering ? "Rejoignez" : "Bienvenue sur"}
          </p>
          <h1 className="mt-1 text-[34px] font-bold leading-[1.1] tracking-[-0.03em] text-[#0B3B24]">
            {isRegistering ? "Créer un compte" : "RecMatch"}
          </h1>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#8A8F8C]">
            Connectez-vous pour consulter vos fichiers et analyses.
          </p>

          <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
            {notice && (
              <p role="status" className="rounded-xl border border-[#2E9B62]/30 bg-[#E3F3EA] p-3 text-sm text-[#14573A]">
                {notice}
              </p>
            )}
            {message && (
              <p role="status" className="rounded-xl border border-[#2E9B62]/30 bg-[#E3F3EA] p-3 text-sm text-[#14573A]">
                {message}
              </p>
            )}

            {isRegistering && (
              <Field
                id="rm-name"
                label="Nom"
                type="text"
                autoComplete="name"
                maxLength={120}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Votre nom"
              />
            )}

            <Field
              id="rm-email"
              label="Adresse e-mail"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="vous@exemple.com"
            />

            <Field
              id="rm-password"
              label="Mot de passe"
              type={showPassword ? "text" : "password"}
              autoComplete={isRegistering ? "new-password" : "current-password"}
              minLength={10}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••"
              hint={isRegistering ? "10 caractères minimum" : undefined}
              trailing={<EyeButton shown={showPassword} onClick={() => setShowPassword((v) => !v)} />}
            />

            {isRegistering && (
              <Field
                id="rm-confirm"
                label="Confirmer le mot de passe"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={10}
                maxLength={256}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••••"
              />
            )}

            {error && (
              <p role="alert" className="rounded-xl border border-[#E5484D]/30 bg-[#FDECEC] p-3 text-sm text-[#B42318]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 self-start rounded-full bg-gradient-to-br from-[#14573A] to-[#1B6B43] px-10 py-3.5 text-sm font-semibold tracking-wide text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_10px_20px_-10px_#14573A] disabled:pointer-events-none disabled:opacity-60"
            >
              {busy ? "CHARGEMENT..." : isRegistering ? "CRÉER MON COMPTE" : "SE CONNECTER"}
            </button>
          </form>

          <p className="mt-auto pt-8 text-[12.5px] text-[#8A8F8C]">
            {isRegistering ? "Vous avez déjà un compte ? " : "Pas encore de compte ? "}
            <button
              type="button"
              onClick={toggleMode}
              className="font-semibold text-[#1F7F55] transition-colors hover:text-[#14573A] hover:underline"
            >
              {isRegistering ? "Se connecter" : "S’inscrire"}
            </button>
          </p>
        </section>

        {/* Panneau illustration */}
        <section className="relative hidden min-h-[580px] md:block">
          <Illustration />
        </section>
      </div>
    </main>
  );
}