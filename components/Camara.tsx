'use client';

// Cámara trasera con un recuadro para centrar el QR. Lee con BarcodeDetector (Chrome/Android) y, donde no existe
// (iPhone, Chrome de escritorio), con jsQR, que se descarga solo en ese caso. El QR lleva el código del cupón.
// Se apaga al salir de la pantalla y cuando la pestaña queda oculta.

import { useEffect, useEffectEvent, useState } from 'react';
import s from './Canjear.module.css';

type Lector = (v: HTMLVideoElement) => Promise<string | null>;

async function crearLector(): Promise<Lector> {
  type Detector = { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> };
  const BD = (window as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  try {
    if (BD && (await BD.getSupportedFormats()).includes('qr_code')) {
      const bd = new BD({ formats: ['qr_code'] });
      return async (v) => (await bd.detect(v))[0]?.rawValue ?? null;
    }
  } catch { /* sigue con jsQR */ }
  const { default: jsQR } = await import('jsqr');
  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
  return async (v) => {
    const k = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight)); // achicado: lee igual y es más rápido
    lienzo.width = Math.round(v.videoWidth * k);
    lienzo.height = Math.round(v.videoHeight * k);
    ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height);
    return jsQR(ctx.getImageData(0, 0, lienzo.width, lienzo.height).data, lienzo.width, lienzo.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}

export default function Camara({ onLeido }: { onLeido: (texto: string) => void }) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [falla, setFalla] = useState<string | null>(null);
  const [oculta, setOculta] = useState(false);
  const leido = useEffectEvent(onLeido);

  useEffect(() => {
    const ver = () => setOculta(document.hidden);
    document.addEventListener('visibilitychange', ver);
    return () => document.removeEventListener('visibilitychange', ver);
  }, []);

  useEffect(() => {
    if (!video || oculta) return;
    let viva = true;
    let stream: MediaStream | null = null;
    let espera = 0;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        return setFalla('Este navegador no deja usar la cámara en esta página (hace falta https).');
      }
      try {
        const [flujo, leer] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }),
          crearLector(),
        ]);
        stream = flujo;
        if (!viva) return stream.getTracks().forEach((t) => t.stop());
        video.srcObject = stream;
        await video.play();
        const mirar = async () => {
          if (!viva) return;
          const texto = video.videoWidth ? await leer(video).catch(() => null) : null;
          if (!viva) return;
          if (texto) return leido(texto);
          espera = window.setTimeout(mirar, 150);
        };
        mirar();
      } catch (e) {
        if (!viva) return;
        const nombre = e instanceof DOMException ? e.name : '';
        setFalla(
          nombre === 'NotAllowedError' ? 'No hay permiso para usar la cámara. Habilitalo en el navegador (ícono al lado de la dirección) o escribí el código.'
            : nombre === 'NotFoundError' ? 'No encontramos una cámara en este equipo. Escribí el código.'
              : 'No pudimos abrir la cámara. Probá de nuevo o escribí el código.',
        );
      }
    })();
    return () => {
      viva = false;
      clearTimeout(espera);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [video, oculta]); // al reintentar, el <video> se vuelve a montar y esto corre de nuevo

  return (
    <div className={s.visor}>
      {falla ? (
        <div className={s.visorFalla} role="alert">
          <p>{falla}</p>
          <button type="button" className="btn secondary" onClick={() => setFalla(null)}>
            Probar de nuevo
          </button>
        </div>
      ) : (
        <>
          <p className={s.visorEstado}>Abriendo la cámara…</p>
          <video ref={setVideo} className={s.video} muted playsInline aria-label="Imagen de la cámara" />
          <div className={s.marco} aria-hidden="true" />
          <p className={s.visorAyuda}>Centrá el QR del cupón en el recuadro</p>
        </>
      )}
    </div>
  );
}
