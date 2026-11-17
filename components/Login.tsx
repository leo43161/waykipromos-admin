'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ROLES, type Rol } from '@/lib/roles';
import { ingresar, ingresarDePrueba } from '@/lib/sesion';
import s from './Login.module.css';

const MENSAJES: Record<string, string> = {
  credenciales: 'El usuario o la contraseña no coinciden. Revisalos y probá de nuevo.',
  bloqueado: 'Tu usuario está desactivado. Pedile a quien te creó la cuenta que lo revise.',
  'sin-servidor': 'El ingreso todavía no está habilitado: falta conectar el servidor.',
};

export default function Login() {
  const router = useRouter();
  const [verClave, setVerClave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEnviando(true);
    setError('');
    try {
      await ingresar(String(f.get('usuario')).trim(), String(f.get('password')));
      router.push('/panel/');
    } catch (err) {
      setError(MENSAJES[(err as Error).message] ?? 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.');
      setEnviando(false);
    }
  }

  function entrarDePrueba(rol: Rol) {
    ingresarDePrueba(rol);
    router.push('/panel/');
  }

  return (
    <>
      <form className={s.form} onSubmit={enviar}>
        <label className="field">
          Usuario
          <input name="usuario" required autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={45} />
        </label>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <div className={s.clave}>
            <input id="password" name="password" type={verClave ? 'text' : 'password'} required autoComplete="current-password" />
            <button type="button" onClick={() => setVerClave(!verClave)} aria-pressed={verClave} aria-controls="password">
              {verClave ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn primary full" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p className="small-note">
          ¿Olvidaste tu contraseña? Pedile a quien te creó la cuenta que la restablezca.
        </p>
      </form>

      {/* Solo en `npm run dev` (el build de producción elimina este bloque). */}
      {process.env.NODE_ENV === 'development' && (
        <div className={s.prueba}>
          <p>Desarrollo: entrar sin servidor como</p>
          <div>
            {(Object.keys(ROLES) as Rol[]).map((r) => (
              <button key={r} type="button" className="btn secondary" onClick={() => entrarDePrueba(r)}>{ROLES[r].nombre}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
