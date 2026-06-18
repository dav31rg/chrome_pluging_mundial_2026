# 🌙⚽ Dark Mode + World Cup Chrome Extension

Extensión para Google Chrome que combina dos funcionalidades en una sola herramienta:

* 🌙 Activación de modo oscuro para cualquier sitio web.
* ⚽ Consulta de información de fútbol en tiempo real utilizando la API de TheSportsDB.

## Características

### 🌙 Modo Oscuro

* Activar o desactivar modo oscuro en cualquier página web.
* Configuración almacenada por sitio web.
* Persistencia utilizando Chrome Storage.
* Interfaz simple e intuitiva.

### ⚽ Información de Mundial

#### Búsqueda de equipos

Permite buscar equipos de fútbol por nombre.

#### Últimos partidos

Visualiza los resultados recientes de un equipo.

#### Próximos partidos

Consulta los próximos encuentros programados.

#### Resultados del Mundial 2026

Muestra los partidos disputados en la fecha actual.

#### Estadísticas del partido

Al hacer clic sobre un encuentro se muestran estadísticas detalladas como:

* Posesión
* Tiros
* Tiros al arco
* Estadísticas avanzadas disponibles en la API

## Tecnologías utilizadas

* HTML5
* CSS3
* JavaScript (ES6+)
* Chrome Extensions API (Manifest V3)
* TheSportsDB API

## Arquitectura del proyecto

```text
project/
│
├── manifest.json
├── popup.html
├── popup.js
├── popup.css
├── content.js
├── icons/
│
└── assets/
```

## Relación con el patrón Microkernel

```text
┌─────────────────────────────┐
│         Google Chrome       │
│         (Microkernel)       │
├─────────────────────────────┤
│ Chrome Storage API          │
│ Chrome Tabs API             │
│ Chrome Messaging API        │
│ Chrome Scripting API        │
└─────────────┬───────────────┘
              │
      ┌───────┴────────┐
      │                │
┌─────▼─────┐   ┌──────▼─────┐
│ Dark Mode │   │ World Cup  │
│  Plugin   │   │  Plugin    │
└───────────┘   └────────────┘
```

## Flujo de funcionamiento

### Modo Oscuro

1. El usuario abre la extensión.
2. Se detecta la pestaña activa.
3. Se verifica si existe una configuración guardada.
4. Se aplica o elimina el modo oscuro.
5. La preferencia se almacena en Chrome Storage.

### Copa del Mundo 2026

1. El usuario busca un equipo.
2. La extensión consulta TheSportsDB.
3. Se muestran los datos del equipo.
4. Se cargan:

   * Últimos partidos.
   * Próximos partidos.
5. Al seleccionar un partido:

   * Se consultan estadísticas adicionales.
   * Los resultados se almacenan en caché para mejorar el rendimiento.

## API utilizada

TheSportsDB

https://www.thesportsdb.com

Endpoints utilizados:

### Buscar equipos

```http
searchteams.php?t={team}
```

### Últimos partidos

```http
eventslast.php?id={teamId}
```

### Próximos partidos

```http
eventsnext.php?id={teamId}
```

### Eventos por fecha

```http
eventsday.php?d={date}&l={leagueId}
```

### Estadísticas del evento

```http
lookupeventstats.php?id={eventId}
```

## Instalación

1. Clonar el repositorio:

```bash
git clone https://github.com/usuario/repositorio.git
```

2. Abrir Chrome.

3. Ir a:

```text
chrome://extensions
```

4. Activar:

```text
Modo desarrollador
```

5. Seleccionar:

```text
Cargar descomprimida
```

6. Elegir la carpeta del proyecto.

## Capturas

<img width="366" height="250" alt="image" src="https://github.com/user-attachments/assets/023a2e29-d0a9-41e8-9186-b8729c1d24e6" />
<br><br>
<img width="366" height="607" alt="image" src="https://github.com/user-attachments/assets/710b8084-ebc8-46ff-8de1-a7ef54e250b3" />
<br><br>
<img width="366" height="605" alt="image" src="https://github.com/user-attachments/assets/a909b874-8d0d-41e4-a73e-34eb690057f9" />
<br><br>

v2:
<br><br>
<img width="366" height="361" alt="image" src="https://github.com/user-attachments/assets/fadc081c-f3dd-4f1a-982a-2258f5a442a3" />


## Autores

Este proyecto fue desarrollado como ejemplo práctico de la arquitectura Microkernel (Plug-in Architecture) por:
  - Dante Rodolfo Tarraga Usca
  - Davel Reymundo Gobea
  - Humberto Alejandro Lizana Ventura

