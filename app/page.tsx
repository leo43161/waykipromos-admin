import type { Metadata } from 'next';
import Brand from '@/components/Brand';
import Login from '@/components/Login';
import { asset } from '@/lib/asset';
import s from './ingresar.module.css';

export const metadata: Metadata = { title: 'Ingresar' };

const QUIENES = ['Ente Tucumán Turismo', 'Comercios adheridos', 'Empleados en el mostrador'];

export default function IngresarPage() {
  return (
    <div className={s.pagina}>
      {/* Escena del manual: fondo-oscuro-profesional.svg del kit + Wayki asomando sobre las lomas */}
      <aside className={s.escena}>
        <img className={s.fondo} src={asset('/wayki-promo/fondos/fondo-oscuro-profesional.svg')} alt="" width={1920} height={1080} />
        <div className={s.escenaTexto}>
          <p className={`display ${s.lema}`}>Detrás de cada cupón</p>
          <ul className={s.quienes} aria-label="Quiénes usan este panel">
            {QUIENES.map((q) => <li key={q}>{q}</li>)}
          </ul>
        </div>
        <img className={s.wayki} src={asset('/wayki-promo/mascota/wayki-busto.png')} alt="" width={546} height={456} />
      </aside>

      <main id="contenido" className={s.lado}>
        <div className={s.tarjeta}>
          <Brand label="Panel" />
          <div className={s.titulo}>
            <h1>Ingresá a tu panel</h1>
            <p className="muted">Usá el usuario y la contraseña que te dieron el Ente o tu comercio.</p>
          </div>
          <Login />
        </div>
        <img className={s.logoTtt} src={asset('/wayki-promo/marca/logo-tucuman-tiene-todo.png')} alt="Tucumán tiene todo" width={110} height={48} />
      </main>
    </div>
  );
}
