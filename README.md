# 💳 Card Issue Management System

Sistema de microservicios impulsado por eventos (Event-Driven Architecture) para la gestión y emisión de tarjetas. Implementa el patrón de coreografía de eventos (Saga), resiliencia con retraso exponencial (Exponential Backoff) y una cola de mensajes muertos (Dead Letter Queue - DLQ) utilizando Node.js, TypeScript y Kafka.

## 1. Requisitos Mínimos

Para ejecutar este proyecto de manera local, asegúrate de contar con las siguientes herramientas instaladas:

* **Node.js**: `v20.0.0` o superior (Requerido por motor estricto en el `package.json`).
* **npm**: `v10.0.0` o superior.
* **Docker y Docker Compose**: Para la orquestación de la infraestructura (Kafka y Zookeeper).

## 2. Instalación de Dependencias

El proyecto está dividido en dos microservicios principales (`card-issuer` y `card-processor`). Debes instalar las dependencias de manera independiente en cada entorno.

### 2.1 Instalación del Emisor (API)
```bash
cd card-issuer
npm install
```

### 2.2 Instalación del Procesador (Worker)
```bash
cd card-processor
npm install
```

## 3. Estructura de Archivos

Ambos microservicios respetan una estricta **Arquitectura Hexagonal** (Puertos y Adaptadores) acoplada con Inyección de Dependencias mediante `InversifyJS`.

### `card-issuer/` (API REST y Emisor/Consumidor de Eventos)
```text
card-issuer/
├── src/
│   ├── configs/        # Configuración del contenedor de dependencias (Inversify)
│   ├── controllers/    # Adaptadores de entrada HTTP (Express)
│   ├── dtos/           # Objetos de transferencia de datos validados (class-validator)
│   ├── events/         # Handlers y Dispatcher para consumir respuestas de Kafka
│   ├── interfaces/     # Contratos abstractos (Puertos)
│   ├── middlewares/    # Interceptores de Express
│   ├── providers/      # Adaptadores de salida (Kafka Producer/Consumer)
│   ├── repositories/   # Lógica de persistencia de datos
│   ├── routes/         # Definición de rutas REST
│   ├── services/       # Casos de uso core (Dominio)
│   ├── shared/         # Constantes (Tópicos de Kafka) y utilidades
│   ├── app.ts          # Configuración de Express
│   ├── server.ts       # Punto de entrada y Shutdown
│   └── types/          # Símbolos de Inversify
└── package.json
```

### `card-processor/` (Worker Asíncrono de Dominio)
```text
card-processor/
├── src/
│   ├── configs/        # Configuración de Inversify
│   ├── events/         # Handlers y Dispatcher para consumir solicitudes de Kafka
│   ├── interfaces/     # Contratos abstractos
│   ├── providers/      # Adaptadores de conexión (Kafka Producer/Consumer)
│   ├── services/       # Lógica de negocio (Emisión, Reintentos, Simulador)
│   ├── shared/         # Constantes globales
│   ├── worker.ts       # Punto de entrada del consumidor y Shutdown
│   └── types/          # Símbolos de Inversify
└── package.json
```

## 4. Cómo Ejecutar el Proyecto

### Paso 1: Levantar la Infraestructura
En la raíz del proyecto, inicializa los contenedores de Zookeeper y Kafka:
```bash
docker-compose up -d
```
*Nota: Espera unos 15-30 segundos para que Kafka termine de inicializarse y esté listo para aceptar conexiones.*

### Paso 2: Iniciar los Microservicios
Abre dos terminales diferentes en tu editor.

**Terminal 1 (Levantar el Issuer HTTP):**
```bash
cd card-issuer
npm run dev
```
*El servidor HTTP correrá en `http://localhost:3000` y se conectará automáticamente a Kafka.*

**Terminal 2 (Levantar el Processor Worker):**
```bash
cd card-processor
npm run dev
```
*El worker se conectará a Kafka, se unirá a su grupo de consumo y comenzará a escuchar el tópico de solicitudes.*

### Paso 3: Ejecutar los Endpoints

Puedes utilizar Postman, Insomnia o cURL para interactuar con la API.

**1. Solicitar la Emisión de una Tarjeta (Flujo Exitoso / Reintentos)**
```bash
curl -X POST http://localhost:3000/card-issue \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "usr_12345",
    "type": "CREDIT",
    "forceError": true 
  }'
```
*(Nota: El parámetro `forceError: true` indica al procesador que, si la simulación bancaria falla, debe aplicar la lógica de reintentos exponenciales).*

**2. Verificar la Salud del Servicio**
```bash
curl -X GET http://localhost:3000/health
```

## 5. Detalle de los Servicios y Flujo de Eventos

El sistema utiliza una coreografía de eventos para procesar la emisión de tarjetas de manera distribuida, garantizando resiliencia y eventual consistencia.

### Flujo Principal (Saga Pattern)
1. **`card-issuer` (Orquestador de Entrada):**
    * Recibe la petición HTTP POST.
    * Guarda un registro inicial localmente con el estado `pending`.
    * Publica un `CloudEvent` en el tópico `io.card.requested.v1`.
2. **`card-processor` (Worker de Dominio):**
    * Consume el evento de la solicitud.
    * Simula la integración bancaria con un *delay* aleatorio (200-500ms) y una tasa de fallo programada (20%).
    * **Si tiene éxito:** Publica los datos de la tarjeta en `io.cards.issued.v1`.
3. **`card-issuer` (Actualización de Estado):**
    * Escucha de forma asíncrona `io.cards.issued.v1`.
    * Busca la tarjeta localmente mediante el ID original y actualiza su estado a `issued`.

### Resiliencia y Manejo de Errores (Retries & DLQ)
Para garantizar la tolerancia a fallos en la integración con terceros, el `card-processor` implementa una estrategia avanzada de resiliencia gestionada por el `CardRetriesService`:

* **Exponential Backoff:** Si la emisión de la tarjeta falla y el payload contiene `forceError: true`, el sistema no rechaza la tarjeta inmediatamente. En su lugar, realiza hasta **3 reintentos** pausando la ejecución de forma no bloqueante con tiempos incrementales:
  * 1er reintento: Espera 1 segundo.
  * 2do reintento: Espera 2 segundos.
  * 3er reintento: Espera 4 segundos.
* **Dead Letter Queue (DLQ):** Si después de los 3 reintentos el servicio bancario sigue fallando, el evento original junto con el motivo del error se publica en el tópico `io.card.dlq.v1`. Esto permite auditar y reprocesar el mensaje en el futuro sin perder datos.