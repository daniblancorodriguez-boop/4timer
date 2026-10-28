# 4TIMER

Temporizador para CrossFit y entrenamiento funcional. App web (HTML/CSS/JS sin dependencias de ejecución) empaquetada con Capacitor para Android.

## Modos
For Time · AMRAP (con contador de rondas) · AMRAP con descansos · EMOM · Tabata · Intervalos · Descanso · Trabajo = descanso · Fight Gone Bad · Contador de rondas (sin reloj)

- Display LED: tiempo en rojo, rondas en azul (descanso en verde).
- Pausa, reiniciar y terminar en todos los modos.
- Cuenta atrás previa configurable (10 s por defecto) con pitidos 3-2-1.
- Sonido distinto para inicio, cambio de minuto, trabajo, descanso y fin. Se puede elegir entre sonidos incluidos o subir uno propio (máx. 700 KB).
- Entrenamientos predefinidos del box: se crean eligiendo ejercicios de la biblioteca (reps, calorías o metros a mano), se pueden editar y borrar.
- Ejercicios: biblioteca con la explicación en español de cada uno; botón (i) junto a cada ejercicio de un entreno.
- Logo y nombre del gimnasio personalizables (Ajustes).

## Probar en el navegador
```
npm run serve     # http://localhost:8080
npm test          # lógica de temporizadores + prueba de interfaz
```

## Generar la app para Google Play
Requisitos: Node 18+, Android Studio (incluye el SDK y JDK) y una cuenta de Google Play Console.

1. `npm install`
2. `npm run android:init`  (crea la carpeta `android/` y copia la web)
3. Iconos: en Android Studio, clic derecho en `app/src/main/res` → New → Image Asset. Usa `www/icons/icon-1024.png` como foreground/legacy y `#050506` como fondo.
4. `npm run android:open` y en Android Studio:
   - `Build → Generate Signed App Bundle / APK → Android App Bundle (.aab)`.
   - Crea una keystore nueva y **guárdala con copia de seguridad**: sin ella no podrás actualizar la app.
5. En Play Console: crear app → subir el `.aab` en una pista de prueba o producción → ficha de la tienda (descripción, capturas, icono 512×512 = `www/icons/icon-512.png`, gráfico de funciones 1024×500) → política de privacidad → cuestionario de contenido y seguridad de datos (la app no recoge datos; todo se guarda en el dispositivo).

Cada vez que cambies algo en `www/`: `npm run android:sync`, sube `versionCode` en `android/app/build.gradle` y genera un nuevo `.aab`.

El `appId` (`es.fourtime.timer`) es el identificador definitivo de la app en Google Play: cámbialo en `capacitor.config.json` **antes** de `android:init` si quieres otro.

## Compartir en Instagram (estilo Strava)

Al terminar un entreno el botón **Pausa** pasa a **Compartir**. Se genera una imagen (Story 9:16 o Post 4:5) con el logo del gimnasio, el logo 4TIMER, el entreno y sus ejercicios, y:
- **AMRAP / AMRAP con descansos**: número de rondas (en azul, LED).
- **For Time**: tiempo realizado (en rojo, LED).
- Resto de modos: duración.

Puedes **hacer una foto** o **elegir una de la galería** como fondo, quitarla, ocultar los ejercicios y **Compartir** (menú del móvil → Instagram) o **Guardar imagen**.

En Android (Capacitor) hacen falta los plugins nuevos: `npm install` y luego `npx cap sync android`
(`@capacitor/share` y `@capacitor/filesystem`). Instagram se abre desde el menú de compartir del sistema;
saltar directo a Stories requeriría código nativo adicional. La ruta nativa no se ha probado en un dispositivo real.

## Sonidos exactos (pantalla apagada)

Los pitidos ya no dependen del temporizador de la página: la app conoce de antemano todos los eventos del entreno
(`Timer.timeline`) y los **programa en el reloj de Web Audio con 12 s de margen**, renovándolos constantemente. Pausa, reiniciar
y terminar cancelan lo pendiente; al reanudar se reprograman con el desfase exacto. Medido en Chromium: error ≤ 10 ms.

Para que Android no duerma la app con la pantalla apagada hace falta un **servicio en primer plano** (código nativo, no incluido y
sin probar en dispositivo). Opción: plugin de Capacitor para foreground service (p. ej. `@capawesome-team/capacitor-android-foreground-service`)
iniciándolo al pulsar Empezar y parándolo al salir del reloj, más el permiso `FOREGROUND_SERVICE` en el manifiesto.

## Sonidos por tipo (accesibilidad)

En Ajustes → «Aplicar sonidos distintos por tipo»: pitido corto y agudo = trabajo, tono largo y grave = descanso, y cada evento
(cuenta atrás, inicio, minuto, fin) suena distinto. La vibración también cambia: corta doble = trabajo, larga = descanso.

## Historial y marcas personales

Al terminar un entreno con el reloj se guarda solo (también «Guardar en el historial» en Compartir entreno). Agrupa por nombre y modo;
For Time: gana el menor tiempo; AMRAP: más rondas (y repeticiones). Muestra la diferencia con la vez anterior, la gráfica de evolución,
«Repetir este entreno» y la insignia «NUEVO PR» en la tarjeta de compartir.

## Plantillas de tarjeta

Story 9:16, Post 4:5 y **Horizontal 16:9**, con logo normal o **logo grande** del gimnasio.

## Running (GPS, series y programas)
Menú → **Running**.
- **Carrera libre**: tiempo, km, ritmo actual (últimos 20 s) y medio, parcial de cada km, recorrido dibujado **sin mapa** (privacidad). Pausa automática opcional.
- **Programas por semanas**: Programa → Semana → Parte (A, B…) → pasos por tiempo o distancia, con bloques repetidos (p. ej. 5 rondas sin descanso). Cada parte se ejecuta y se guarda **por separado**. Intensidad: Andar / Suave / Medio / Fuerte / Sprint + nota libre ("3/10", "50 %"). En cada cambio suena un sonido distinto según la intensidad (ajustable en Ajustes) y vibra; no dice si vas al ritmo correcto.
- El entrenador crea el programa en la app y lo **exporta** (texto o archivo `.4timer.json`); los alumnos lo **importan** manualmente (Running → Importar programa). Se valida todo (rangos de tiempo/distancia, nº de pasos, textos) antes de guardar.
- **Importar carrera del reloj**: GPX, TCX o FIT exportados desde la app de la pulsera (Zepp, Mi Fitness…).
- Resultado: parciales por km, mejores tramos (1 km, 5 km, 10 km, media) con aviso de PR, **tarjeta para compartir** con el recorrido dibujado (por defecto se ocultan los primeros y últimos 200 m) y **exportar GPX**.
- Hay un programa de ejemplo («Base aeróbica») que se puede borrar.

### Android (hay que probarlo en un móvil real)
Plugins nuevos: `@capacitor-community/background-geolocation` (GPS con pantalla apagada, servicio en primer plano) y `@capacitor/local-notifications` (avisos que vibran en la pulsera). Tras `npm install` y `npx cap sync android`, en `android/app/src/main/AndroidManifest.xml` añade:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```
Google Play pedirá una declaración de uso de la ubicación en segundo plano (el gimnasio puede justificarla: registrar la carrera con la pantalla apagada).

**No probado fuera del navegador**: GPS en segundo plano, notificaciones a la pulsera (Xiaomi/Amazfit no lo garantizan: dependen de que la pulsera reciba notificaciones de 4TIMER), compartir archivos en nativo y consumo de batería. Sin la app nativa (navegador) el GPS solo funciona con la pantalla encendida.

### Notificación fija durante la carrera (Android)
Mientras corres aparece una notificación silenciosa y fija (se ve en la pantalla de bloqueo y en la barra) con tiempo, km, ritmo y el tramo actual; se actualiza cada 5 s. Los avisos de cambio de serie usan otro canal que sí vibra (para la pulsera). No es una «isla flotante» del sistema (como la del cronómetro de Xiaomi): eso depende de la capa del fabricante.

### Mapa real (opcional)
En el resultado de una carrera y en la tarjeta de compartir se puede cambiar de «recorrido dibujado» (por defecto, sin internet y privado) a **mapa real**: teselas oscuras de CARTO con datos de OpenStreetMap, con su atribución dibujada en el mapa. Solo se descargan al pedirlo. Las teselas de CARTO son gratis para uso no comercial; si se publica con fines comerciales, cambia la URL en `www/js/map.js` (`TILE`) por la de un proveedor con licencia (MapTiler, Stadia…).

## Guardar en la galería y vídeo (compartir)
- En el móvil, «Guardar imagen» y «Guardar vídeo» van a la galería, álbum **4TIMER** (plugin `@capacitor-community/media`; tras actualizar: `npm install` y `npx cap sync android`). En el navegador se descargan.
- Vídeo: se elige o graba un vídeo de fondo y la app lo regraba con el logo, el resultado y los ejercicios encima (hasta 60 s, con su audio) usando `MediaRecorder`. El formato (MP4 o WebM) depende del móvil.

## Logo y compartir
- Logo de serie: círculo de 4TIME (`www/icons/gym-logo.png`, transparente fuera del círculo). Si subes uno propio en Ajustes, se usa el tuyo.
- Compartir entreno: opción «Ejercicios arriba a la izquierda (semitransparentes) y entreno abajo» (formatos Story y Post).
- Entrenos de serie p11–p17 (parejas, EMOM par/impar, AMRAP 17', 5R For Time). Los ejemplos nuevos se añaden solos una vez a quien ya tenía la app.

## Estilos de tarjeta con varias fotos (Story)
En «Compartir entreno» hay un selector de estilo: **Normal**, **Carrete 3 + fondo** (tira de fotomatón), **Carrete 4 + 2 fondos** (película inclinada sobre dos fondos) y **Collage 3 + fondo**. Cada hueco tiene su «Hacer foto / Subir foto». Los huecos vacíos solo se ven en la vista previa; al guardar o compartir no salen. Solo en formato Story y sin lista de ejercicios.
