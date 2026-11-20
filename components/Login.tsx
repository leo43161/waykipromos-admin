'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { conApi, ErrorApi } from '@/lib/api';
import { ingresar } from '@/lib/sesion';
import { CLAVE_DE_PRUEBA, reiniciarSimulador, USUARIOS_DE_PRUEBA } from '@/lib/simulador';
import s from './Login.module.css';

/** Mientras el ingreso lo simula el navegador, se muestran los usuarios de prueba (también en producción). */
const SIMULADO = !conApi('sesion');

export default function Login() {
  const router = useRouter();
  const [verClave, setVerClave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  async function entrar(usuario: string, password: string) {
    setEnviando(true);
    setError('');
    try {
      await ingresar(usuario, password);
      router.push('/panel/');
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.');
      setEnviando(false);
    }
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    entrar(String(f.get('usuario')).trim(), String(f.get('password')));
  }

  return (
    <>
      <form className={s.form} onSubmit={enviar}>
        <label className="field">
          Usuario
          <input name="usuario" required autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={100} />
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
          ¿Olvidaste tu contraseña? Pedile a quien te creó la cuenta que te genere una nueva.
        </p>
      </form>

      {SIMULADO && (
        <div className={s.prueba}>
          <p>Modo de prueba: entrá como (contraseña de todos: {CLAVE_DE_PRUEBA})</p>
          <div>
            {USUARIOS_DE_PRUEBA.map((u) => (
              <button key={u.usuario} type="button" className="btn secondary" disabled={enviando} onClick={() => entrar(u.usuario, CLAVE_DE_PRUEBA)} title={u.usuario}>
                {u.quien}
              </button>
            ))}
          </div>
          <p className={s.pruebaNota}>
            Los cupones que guardes en la app del turista, en este mismo navegador, se pueden canjear acá.{' '}
            <button type="button" className={s.reiniciar} onClick={() => { reiniciarSimulador(); setAviso('Listo: volvieron los datos de ejemplo.'); }}>
              Reiniciar datos de prueba
            </button>
          </p>
          {aviso && <p role="status" className={s.pruebaNota}>{aviso}</p>}
        </div>
      )}
    </>
  );
}
