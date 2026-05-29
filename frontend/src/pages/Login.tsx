import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Lock, Eye, EyeOff, Shield, Info, MessageCircle } from 'lucide-react'
import wabbiLogo from '@/assets/logos/wabbi-logo.png'

const NAVY = '#050d1a'
const NAVY_BTN = '#0a1628'
// Brand violets (sacados del favicon)
const BRAND_DEEP = '#5b14ff'
const BRAND_BRIGHT = '#863bff'
const WHATSAPP_GREEN = '#25d366'

interface FieldErrors {
  email?: string
  password?: string
}

export default function Login() {
  const navigate = useNavigate()
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [keepLogged, setKeepLogged] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Mouse-follow gradient + parallax de orbs (efecto profundidad).
  // Usamos CSS variables directamente sobre el ref para evitar re-renders de React.
  useEffect(() => {
    const panel = leftPanelRef.current
    if (!panel) return

    function handleMove(e: MouseEvent) {
      if (!panel) return
      const rect = panel.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      // Spotlight position 0..100%
      panel.style.setProperty('--mx', `${x * 100}%`)
      panel.style.setProperty('--my', `${y * 100}%`)
      // Parallax offsets (orbs se mueven en sentido inverso, máx 20px)
      panel.style.setProperty('--px', `${(0.5 - x) * 40}px`)
      panel.style.setProperty('--py', `${(0.5 - y) * 40}px`)
    }

    function handleLeave() {
      if (!panel) return
      panel.style.setProperty('--mx', `50%`)
      panel.style.setProperty('--my', `50%`)
      panel.style.setProperty('--px', `0px`)
      panel.style.setProperty('--py', `0px`)
    }

    panel.addEventListener('mousemove', handleMove)
    panel.addEventListener('mouseleave', handleLeave)
    return () => {
      panel.removeEventListener('mousemove', handleMove)
      panel.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

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
        className="md:hidden flex flex-col items-center gap-3 py-7 px-6"
        style={{ backgroundColor: NAVY }}
      >
        <img src={wabbiLogo} alt="Wabbi" className="h-10 w-auto" />
        <div className="flex items-center gap-2 text-[12px] text-white/55">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: WHATSAPP_GREEN }} />
          Panel de gestión · WhatsApp
        </div>
        <p className="text-[12px] font-light text-white/55 text-center max-w-[280px] leading-relaxed">
          El centro de control para tus conversaciones de WhatsApp.
        </p>
      </div>

      {/* LEFT PANEL — brand (desktop only) */}
      <div
        ref={leftPanelRef}
        className="hidden md:flex relative overflow-hidden flex-col p-10 text-white group"
        style={{
          backgroundColor: NAVY,
          // Defaults para las CSS vars antes de que el mouse entre
          ['--mx' as string]: '50%',
          ['--my' as string]: '50%',
          ['--px' as string]: '0px',
          ['--py' as string]: '0px',
        }}
      >
        {/* Mouse-follow spotlight (overlay sutil, sigue el cursor) */}
        <div
          className="pointer-events-none absolute inset-0 transition-[background] duration-300 ease-out"
          style={{
            background: `radial-gradient(600px circle at var(--mx) var(--my), rgba(134,59,255,0.18), transparent 50%)`,
          }}
        />

        {/* Animated orbs con parallax */}
        <div
          className="pointer-events-none absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full blur-3xl transition-transform duration-500 ease-out"
          style={{
            background: `radial-gradient(circle, ${BRAND_DEEP} 0%, transparent 65%)`,
            animation: 'orbBreathe 7s ease-in-out infinite',
            transform: 'translate(var(--px), var(--py))',
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-40 -right-40 w-[420px] h-[420px] rounded-full blur-3xl transition-transform duration-500 ease-out"
          style={{
            background: `radial-gradient(circle, ${BRAND_BRIGHT} 0%, transparent 65%)`,
            animation: 'orbBreatheReverse 7s ease-in-out infinite',
            transform: 'translate(calc(var(--px) * -0.6), calc(var(--py) * -0.6))',
          }}
        />

        {/* Tercer orb sutil para más profundidad (drift opuesto) */}
        <div
          className="pointer-events-none absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full blur-3xl opacity-40 transition-transform duration-700 ease-out"
          style={{
            background: `radial-gradient(circle, ${BRAND_BRIGHT} 0%, transparent 70%)`,
            animation: 'orbBreathe 9s ease-in-out infinite',
            transform: 'translate(calc(var(--px) * 0.3), calc(var(--py) * 0.3))',
          }}
        />

        {/* Hero: Wabbi — centrado horizontal y vertical en el espacio restante */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 max-w-[420px] mx-auto text-center">
          <img src={wabbiLogo} alt="Wabbi" className="max-w-[240px] w-full h-auto" />

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/10">
            <span
              className="flex items-center justify-center w-[18px] h-[18px] rounded-full"
              style={{ backgroundColor: WHATSAPP_GREEN }}
            >
              <MessageCircle size={11} className="text-white" strokeWidth={2.5} />
            </span>
            <span className="text-[12px] font-medium text-white/70">Panel de gestión para WhatsApp</span>
          </div>

          <p
            className="text-[22px] font-light leading-snug max-w-[380px]"
            style={{ color: 'rgba(255,255,255,0.78)' }}
          >
            El centro de control para tus conversaciones de WhatsApp.
          </p>

          <p
            className="text-[13px] font-light leading-relaxed max-w-[360px]"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            Administra tus chatbots, conversaciones y automatizaciones desde un solo lugar.
          </p>
        </div>

        {/* Footer */}
        <div
          className="relative z-10 flex items-center justify-center gap-2 pt-5"
          style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}
        >
          <Shield size={12} className="text-white/30" />
          <span className="text-[11px] text-white/30">Acceso privado — solo usuarios autorizados</span>
        </div>
      </div>

      {/* RIGHT PANEL — form */}
      <div className="relative flex items-center justify-center px-6 py-10 md:px-11 md:py-12 overflow-hidden">
        {/* Decorative orb */}
        <div
          className="pointer-events-none absolute -top-20 -right-20 w-[320px] h-[320px] rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, rgba(134,59,255,0.07) 0%, transparent 70%)` }}
        />

        <form
          onSubmit={handleSubmit}
          className="relative z-10 w-full max-w-[400px] space-y-5"
          noValidate
        >
          <div className="space-y-1.5 mb-7">
            <h2
              className="text-[24px] font-semibold leading-tight text-foreground opacity-0"
              style={{ animation: 'fadeUp 0.45s ease-out 0.12s forwards' }}
            >
              Iniciar sesión
            </h2>
            <p
              className="text-[13px] font-light text-muted-foreground opacity-0"
              style={{ animation: 'fadeUp 0.45s ease-out 0.2s forwards' }}
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
                placeholder="usuario@wabbi.com"
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
              style={{ accentColor: BRAND_BRIGHT }}
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
              Este panel es de acceso privado. Si no tienes credenciales, contacta a tu administrador.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
