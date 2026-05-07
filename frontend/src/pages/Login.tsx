import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Lock, Eye, EyeOff, Shield, Info, MessageCircle } from 'lucide-react'
import cleverumLogo from '@/assets/logos/cleverum-logo.png'
import wabbiLogo from '@/assets/logos/wabbi-logo.png'

const NAVY = '#050d1a'
const NAVY_BTN = '#0a1628'
const BLUE_DEEP = '#0d47a1'
const BLUE = '#1565c0'
const WHATSAPP_GREEN = '#25d366'

interface FieldErrors {
  email?: string
  password?: string
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [keepLogged, setKeepLogged] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate(): boolean {
    const errs: FieldErrors = {}
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    if (!email.trim() || !emailOk) errs.email = 'Por favor ingresa un correo válido.'
    if (!password) errs.password = 'La contraseña no puede estar vacía.'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!validate()) return

    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (authError) {
      setError('Credenciales incorrectas')
      setLoading(false)
      return
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-background">
      {/* Mobile-only compact brand header */}
      <div
        className="md:hidden flex flex-col items-center gap-2 py-5 px-6"
        style={{ backgroundColor: NAVY }}
      >
        <img src={wabbiLogo} alt="Wabbi" className="h-10 w-auto" />
        <div className="flex items-center gap-2 text-[11px] text-white/45">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: WHATSAPP_GREEN }} />
          Panel de gestión · WhatsApp
        </div>
      </div>

      {/* LEFT PANEL — brand (desktop only) */}
      <div
        className="hidden md:flex relative overflow-hidden flex-col justify-between p-10 text-white"
        style={{ backgroundColor: NAVY }}
      >
        {/* Animated orbs */}
        <div
          className="pointer-events-none absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle, ${BLUE_DEEP} 0%, transparent 65%)`,
            animation: 'orbBreathe 7s ease-in-out infinite',
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-40 -right-40 w-[420px] h-[420px] rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle, ${BLUE} 0%, transparent 65%)`,
            animation: 'orbBreatheReverse 7s ease-in-out infinite',
          }}
        />

        {/* Top: Cleverum logo */}
        <div className="relative z-10">
          <img src={cleverumLogo} alt="Cleverum" className="h-7 w-auto" />
        </div>

        {/* Hero: Wabbi */}
        <div className="relative z-10 flex flex-col items-start gap-4 max-w-[280px]">
          <img src={wabbiLogo} alt="Wabbi" className="max-w-[200px] w-full h-auto" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10">
            <span
              className="flex items-center justify-center w-[18px] h-[18px] rounded-full"
              style={{ backgroundColor: WHATSAPP_GREEN }}
            >
              <MessageCircle size={11} className="text-white" strokeWidth={2.5} />
            </span>
            <span className="text-[11px] text-white/45">Panel de gestión para WhatsApp</span>
          </div>
          <p
            className="text-[13px] font-light leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.38)' }}
          >
            Administra tus chatbots, conversaciones y automatizaciones desde un solo lugar.
          </p>
        </div>

        {/* Footer */}
        <div
          className="relative z-10 flex items-center gap-2 pt-5"
          style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}
        >
          <Shield size={12} className="text-white/25" />
          <span className="text-[11px] text-white/25">Acceso privado — solo usuarios autorizados</span>
        </div>
      </div>

      {/* RIGHT PANEL — form */}
      <div className="relative flex items-center justify-center px-6 py-10 md:px-11 md:py-12 overflow-hidden">
        {/* Decorative orb */}
        <div
          className="pointer-events-none absolute -top-20 -right-20 w-[320px] h-[320px] rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, rgba(21,101,192,0.06) 0%, transparent 70%)` }}
        />

        <form
          onSubmit={handleSubmit}
          className="relative z-10 w-full max-w-[400px] space-y-5"
          noValidate
        >
          <div className="space-y-2 mb-7">
            <p
              className="text-[11px] uppercase tracking-[1.5px] text-muted-foreground opacity-0"
              style={{ animation: 'fadeUp 0.45s ease-out 0.1s forwards' }}
            >
              Panel de administración
            </p>
            <h2
              className="font-serif-display text-[30px] leading-tight text-foreground opacity-0"
              style={{ animation: 'fadeUp 0.45s ease-out 0.18s forwards' }}
            >
              Iniciar sesión
            </h2>
            <p
              className="text-[13px] font-light text-muted-foreground opacity-0"
              style={{ animation: 'fadeUp 0.45s ease-out 0.25s forwards' }}
            >
              Ingresa tus credenciales para continuar.
            </p>
          </div>

          {/* Email */}
          <div
            className="space-y-1.5 opacity-0"
            style={{ animation: 'fadeUp 0.45s ease-out 0.32s forwards' }}
          >
            <Label htmlFor="email" className="text-[12px] font-medium text-muted-foreground">
              Correo electrónico
            </Label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: undefined })) }}
                placeholder="usuario@cleverum.com"
                autoComplete="email"
                aria-invalid={!!fieldErrors.email}
                className={`pl-10 h-11 rounded-[10px] ${fieldErrors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
            </div>
            {fieldErrors.email && (
              <p className="text-[12px] text-destructive">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password */}
          <div
            className="space-y-1.5 opacity-0"
            style={{ animation: 'fadeUp 0.45s ease-out 0.38s forwards' }}
          >
            <Label htmlFor="password" className="text-[12px] font-medium text-muted-foreground">
              Contraseña
            </Label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(p => ({ ...p, password: undefined })) }}
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={!!fieldErrors.password}
                className={`pl-10 pr-10 h-11 rounded-[10px] ${fieldErrors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="text-[12px] text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          {/* Remember me */}
          <label
            className="flex items-center gap-2 text-[12px] text-muted-foreground cursor-pointer select-none opacity-0"
            style={{ animation: 'fadeUp 0.45s ease-out 0.44s forwards' }}
          >
            <input
              type="checkbox"
              checked={keepLogged}
              onChange={e => setKeepLogged(e.target.checked)}
              className="cursor-pointer"
              style={{ accentColor: BLUE }}
            />
            Mantener sesión iniciada
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="relative w-full overflow-hidden rounded-[10px] py-[13px] text-[14px] font-medium text-white transition opacity-0 hover:opacity-90 hover:-translate-y-px active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              backgroundColor: NAVY_BTN,
              animation: 'fadeUp 0.45s ease-out 0.5s forwards',
            }}
          >
            <span className="relative z-10">{loading ? 'Entrando...' : 'Entrar a Wabbi'}</span>
            {/* Shine */}
            <span
              aria-hidden
              className="absolute top-0 left-0 h-full w-1/3 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
                animation: 'btnShine 3.5s ease-in-out infinite',
              }}
            />
          </button>

          {error && (
            <p className="text-[13px] text-destructive text-center">{error}</p>
          )}

          {/* Private access note */}
          <div
            className="flex items-start gap-2 rounded-[10px] border bg-muted/40 px-[14px] py-[11px] opacity-0"
            style={{
              borderWidth: '0.5px',
              animation: 'fadeUp 0.45s ease-out 0.56s forwards',
            }}
          >
            <Info size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-[11.5px] leading-[1.55] text-muted-foreground">
              Este panel es de acceso privado. Si no tienes credenciales, contacta a tu administrador en Cleverum.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
