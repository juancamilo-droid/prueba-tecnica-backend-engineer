# Evaluación — Prueba Técnica Backend Engineer

**Candidato:** Gian Pierree
**Repositorio evaluado:** `prueba-tecnica-backend-engineer`
**Fecha de evaluación:** 2026-03-19

---

## Resumen Ejecutivo

| Área | Calificación |
|---|---|
| card-issuer (REST API) | 75% |
| card-processor (Consumer) | 80% |
| Estructura de eventos (CloudEvents) | 45% |
| Requisitos técnicos transversales | 78% |
| **Calificación Global** | **72%** |

---

## 1. card-issuer (REST API) — 75%

### ✅ Lo que se implementó correctamente

- **Endpoint POST funcional**: Se implementó el endpoint `POST /card-issue` con Express 5, controlador, ruta y validación integrados correctamente.
- **Validación del payload**: Uso de `class-validator` y `class-transformer` con clases DTO correctamente estructuradas (`CreateCardIssueDto`), incluyendo validaciones de tipo, formato de email, mínimo de edad (18), y valores permitidos para `documentType` (`DNI/CE/RUC`), `type` (`VISA`) y `currency` (`PEN/USD`).
- **Generación de requestId**: Se implementó un middleware (`request-context.middleware.ts`) que genera un UUID por solicitud y lo adjunta al request y a la cabecera `x-request-id`.
- **Publicación a Kafka**: El servicio publica correctamente al tópico `io.card.requested.v1` tras persistir el registro.
- **Almacenamiento en memoria**: El repositorio usa un `Map<string, ICardIssue>` en memoria como mecanismo de persistencia local, con métodos `save` y `updateStatus`.
- **Consumo asíncrono de `io.cards.issued.v1`**: El `card-issuer` también actúa como consumidor del tópico de respuesta para actualizar el estado de la tarjeta a `issued`.
- **Health check**: Endpoint `GET /health` implementado.
- **Graceful shutdown**: Manejo de `SIGTERM` y `SIGINT` para cierre ordenado del servidor y desconexión de Kafka.

### ⚠️ Observaciones y desviaciones

- **Ruta incorrecta**: El enunciado especifica `POST /cards/issue`, pero la implementación expone `POST /card-issue`. Si bien es un detalle menor, en un contrato de API esto representa una violación del contrato.
- **Regla de negocio no implementada**: El enunciado establece explícitamente que *"cada cliente solo puede solicitar y ser acreedor de una única tarjeta"*. El repositorio en memoria no valida si el `documentNumber` del cliente ya tiene una tarjeta registrada, permitiendo duplicados sin restricción.
- **Respuesta diferente a la especificada**: El contrato pide `{ requestId, status }` pero la respuesta actual retorna `{ success, message, requestId, cardIssue: { id, status } }`. Incluye la información requerida pero con una estructura diferente.
- **Validación de formato de `documentNumber`**: El campo acepta cualquier string no vacío. Para DNI peruano debería validarse 8 dígitos numéricos.

---

## 2. card-processor (Consumer) — 80%

### ✅ Lo que se implementó correctamente

- **Consumo del tópico correcto**: Escucha `io.card.requested.v1` mediante `CardRequestedHandler` registrado en el `EventDispatcher`.
- **Simulación de carga externa**: `CardEmissionService.generateCard()` implementa un delay aleatorio entre 200ms y 500ms correctamente.
- **Algoritmo de éxito/fallo aleatorio**: Probabilidad de éxito del 80% (`Math.random() < 0.8`), lo que garantiza fallos periódicos para ejercitar la lógica de reintentos.
- **Flag `forceError`**: Implementado y funcional. Si es `false`, el procesador descarta la tarjeta sin reintentar; si es `true`, activa el backoff exponencial.
- **Generación de datos de tarjeta**: `generateCard()` construye un objeto con `id`, `cardNumber`, `expirationDate` y `cvv`. El número de tarjeta inicia con "4" (VISA), la fecha de vencimiento usa formato `MM/YY`, y el CVV es de 3 dígitos.
- **Publicación a `io.cards.issued.v1`**: En caso de éxito, `CardProcessorService` publica correctamente el evento de tarjeta emitida.
- **Reintentos con backoff exponencial**: `CardRetriesService` implementa correctamente los 3 reintentos con tiempos de espera de 1s, 2s y 4s usando `Math.pow(2, attempt - 1) * 1000`.
- **Publicación al DLQ**: Al agotar reintentos, publica al tópico DLQ correctamente.

### ⚠️ Observaciones y desviaciones

- **Nombre del tópico DLQ incorrecto**: El enunciado especifica `io.card.requested.v1.dlq` pero la implementación usa `io.card.dlq.v1`. Es una desviación del contrato de tópicos.
- **Payload del DLQ incompleto**: El enunciado pide incluir explícitamente *"razón, intentos y payload original"*. El evento publicado al DLQ solo reenvía el payload original (`ICardIssuePayload`) sin un campo `reason` (mensaje de error) ni el campo `attempts` con el número de reintentos realizados.
- **Dependencias en `package.json` de card-processor vacías**: El `package.json` del microservicio `card-processor` no declara `kafkajs`, `inversify`, `pino` ni otras dependencias de runtime en su sección `dependencies`. Funciona por el uso de npm workspaces, pero no es una práctica correcta para microservicios que deben ser autónomos y desplegables de forma independiente.
- **CVV y número de tarjeta logueados en texto plano**: Datos sensibles de la tarjeta se registran directamente en los logs (`logger.info(JSON.stringify(card))`), lo cual es una vulnerabilidad de seguridad.

---

## 3. Estructura de Eventos (CloudEvents) — 45%

### ✅ Lo que se implementó correctamente

- **Campos base de CloudEvents**: La interfaz `IKafkaCloudEvent<T>` incluye `id`, `source`, `specversion`, `type`, `time` y `data`, lo cual es una implementación válida del estándar CloudEvents 1.0.
- **Campo `type`**: Los eventos usan correctamente el nombre del tópico como tipo (`io.card.requested.v1`, `io.cards.issued.v1`).
- **Campos adicionales correctos**: Se añade `specversion: '1.0'` y `time` (ISO string), que son buenas prácticas del estándar.

### ⚠️ Observaciones y desviaciones

- **Campo `id` incorrecto**: El enunciado especifica que `id` debe ser un *número auto-incremental por cada evento en la ejecución*. La implementación usa `crypto.randomUUID()`, que genera un UUID aleatorio. Esto rompe el contrato especificado.
- **Campo `source` incorrecto**: El enunciado define `source` como un *UUID compartido que identifica un flujo de ejecución* (correlation ID). La implementación usa strings estáticos como `/services/cards/card-issuer`, que son identificadores del servicio, no del flujo. Esto impide correlacionar eventos de un mismo request a través de los servicios.
- **Campo `data.error` no implementado**: El contrato especifica `data.error` para detalles de error cuando corresponda. No se utiliza en ningún evento, ni siquiera en el DLQ.

---

## 4. Requisitos Técnicos Transversales

### 4.1 Node.js ≥ 20 + TypeScript — 90%

TypeScript utilizado correctamente en ambos microservicios con configuración `tsconfig.json`. README especifica Node.js v20+. El campo `engines` no está definido en `package.json` para enforcement automático.

### 4.2 KafkaJS (Productor y Consumidor) — 95%

KafkaJS implementado con productores y consumidores bien abstraídos detrás de interfaces (`IKafkaEventBroker`, `IKafkaEventConsumer`). Patrones de conexión, publicación y suscripción correctos.

### 4.3 Docker Compose con Kafka — 85%

Docker Compose funcional con Zookeeper y Kafka. Observación: la imagen `confluentinc/cp-enterprise-kafka:5.5.3` es una versión antigua (2020). Se podría usar `confluentinc/cp-kafka:7.x` o `bitnami/kafka` más reciente. No se incluye un `healthcheck` en los contenedores.

### 4.4 Buenas prácticas en manejo de eventos — 85%

Patrón `EventDispatcher` + handlers desacoplados muy bien implementado. Uso de interfaces para abstraer contratos. Arquitectura hexagonal visible y coherente. Inversión de dependencias con InversifyJS correctamente aplicada.

### 4.5 Confiabilidad del código — 70%

- Reintentos con backoff exponencial ✅
- DLQ implementado (con nombre incorrecto) ✅
- Graceful shutdown en ambos servicios ✅
- La regla de negocio de unicidad de tarjeta por cliente **no está implementada** ❌
- Sin tests automatizados (el `package.json` raíz tiene `"test": "echo error"`) ❌

### 4.6 Monitoreo claro (obligatorio) — 60%

- Logging estructurado con `pino` y `pino-pretty` en todos los servicios: correcto y consistente ✅
- Endpoint `/health` en el API ✅
- **No hay métricas de aplicación** (Prometheus, statsd, etc.) ❌
- **No hay trazabilidad distribuida** (el `source` del evento no sirve como correlation ID real) ❌
- **No hay dashboards ni alertas** ❌

Para un requerimiento marcado como "obligatorio", el logging es necesario pero no suficiente como monitoreo completo.

### 4.7 Prácticas de desarrollo seguro — 50%

- Validación de inputs en el API con DTOs ✅
- **CVV y número de tarjeta logueados en texto plano** ❌ (dato sensible PCI)
- Sin rate limiting en la API ❌
- Sin `helmet.js` u otras cabeceras de seguridad HTTP ❌
- Variables de entorno usadas para configuración de Kafka ✅ pero sin validación de que estén presentes
- Sin `.env.example` para documentar variables requeridas ❌

### 4.8 README con ejecución del proyecto — 95%

README muy completo y bien estructurado. Incluye requisitos mínimos, instalación, estructura de archivos, pasos de ejecución con comandos cURL de ejemplo y descripción del flujo con resiliencia. Muestra dominio del problema.

### 4.9 Arquitectura modular y desacoplamiento — 92%

Arquitectura hexagonal (puertos y adaptadores) bien aplicada en ambos microservicios. Inyección de dependencias con InversifyJS. Separación clara entre controladores, servicios, repositorios, proveedores y handlers. Las interfaces definen correctamente los contratos entre capas.

---

## 5. Tabla de Calificaciones por Requisito

| Requisito | Calificación | Observación clave |
|---|---|---|
| Endpoint POST /cards/issue | 70% | Implementado en `/card-issue`, ruta diferente a la especificada |
| Validación de payload | 90% | Sólida, falta validación de formato DNI |
| Generación de requestId | 95% | Middleware correcto |
| Publicación a `io.card.requested.v1` | 100% | Correcto |
| Almacenamiento en memoria | 95% | Funcional, sin índice por documentNumber |
| Respuesta `{ requestId, status }` | 80% | Incluye los datos pero con estructura diferente |
| **Regla: 1 tarjeta por cliente** | **0%** | No implementada |
| Consumo de `io.card.requested.v1` | 100% | Correcto |
| Simulación de carga externa (200-500ms) | 100% | Correcto |
| Algoritmo aleatorio éxito/fallo | 100% | 80% éxito, bien implementado |
| Flag `forceError` | 100% | Implementado y funcional |
| Datos de tarjeta (id, número, vencimiento, cvv) | 95% | Completo, número inicia en "4" (VISA) |
| Publicación a `io.cards.issued.v1` en éxito | 100% | Correcto |
| Reintentos exponenciales (1s, 2s, 4s) | 100% | Correcto |
| Publicación al DLQ tras max reintentos | 70% | Tópico con nombre incorrecto, payload incompleto |
| Estructura CloudEvents — `id` | 20% | Usa UUID en lugar de entero auto-incremental |
| Estructura CloudEvents — `source` | 30% | Usa path estático en lugar de UUID de flujo |
| Estructura CloudEvents — `data.error` | 0% | No implementado |
| Node.js ≥ 20 + TypeScript | 90% | Correcto, sin `engines` en package.json |
| KafkaJS (productor y consumidor) | 95% | Muy bien implementado |
| Docker Compose con Kafka | 85% | Funcional, imagen desactualizada |
| Buenas prácticas en manejo de eventos | 85% | Dispatcher pattern, interfaces correctas |
| Confiabilidad del código | 70% | Sin tests, regla de negocio faltante |
| Monitoreo claro (obligatorio) | 60% | Solo logging y /health, sin métricas ni tracing |
| Prácticas de desarrollo seguro | 50% | Sin rate limiting, datos sensibles en logs |
| README con ejecución | 95% | Muy completo y bien documentado |
| Arquitectura modular y desacoplamiento | 92% | Hexagonal + DI, muy bien aplicado |

---

## 6. Calificación Global: 72%

---

## 7. Feedback para el Candidato

---

Hola Gian,

Gracias por participar en el proceso de selección y por dedicarle tiempo a esta prueba técnica. A continuación encontrarás un resumen detallado de la evaluación de tu implementación.

### Fortalezas

La calidad de tu arquitectura es el punto más destacado de la solución. Implementaste una **arquitectura hexagonal** con inversión de dependencias a través de InversifyJS de manera coherente y consistente en ambos microservicios. Esta separación entre controladores, servicios, repositorios y proveedores demuestra un buen criterio de diseño para sistemas distribuidos.

El **flujo de eventos completo** está funcional: el `card-issuer` publica en Kafka, el `card-processor` consume, ejecuta reintentos con backoff exponencial correcto (1s, 2s, 4s), y publica al DLQ al agotar los intentos. El **logging estructurado con Pino** está bien aplicado en todas las capas, y el **README** es de muy buena calidad: claro, ordenado y con instrucciones de ejecución paso a paso.

### Áreas de Mejora

**1. Regla de negocio crítica no implementada**
El enunciado establece que *"cada cliente solo puede solicitar y ser acreedor de una única tarjeta"*. Esta validación no existe en el repositorio: si el mismo `documentNumber` hace dos solicitudes, ambas se procesan sin restricción. En un sistema financiero esta es la regla más crítica del dominio.

**2. Estructura del evento CloudEvents no corresponde al contrato**
El enunciado describe `id` como un número auto-incremental por ejecución y `source` como un UUID compartido que identifica un flujo (correlation ID). La implementación usa UUIDs aleatorios en `id` y strings estáticos de ruta en `source`. Esto impide correlacionar eventos del mismo request entre microservicios y rompe el contrato especificado. Tampoco se usa el campo `data.error` definido en el contrato.

**3. Ruta del endpoint diferente**
El endpoint fue implementado en `POST /card-issue` en lugar de `POST /cards/issue`. En contratos de API, la ruta exacta es parte del contrato y cualquier cliente debería poder asumir que se respeta.

**4. Payload del DLQ incompleto**
Al publicar al DLQ, el enunciado pide incluir razón del error y número de intentos. El evento publicado solo incluye el payload original sin estos campos de diagnóstico que son esenciales para el reprocesamiento manual.

**5. Datos sensibles en logs**
El número de tarjeta y el CVV se loguean en texto plano (`logger.info(JSON.stringify(card))`). En un sistema financiero esto es una violación directa de PCI-DSS. Los datos de tarjeta deben ser enmascarados antes de cualquier registro.

**6. Monitoreo**
El requerimiento de monitoreo está marcado como obligatorio. El logging con Pino es un buen punto de partida, pero para un sistema de emisión de tarjetas en producción se esperaría al menos la exposición de métricas (ej. Prometheus `/metrics`) y un correlation ID funcional entre servicios para trazabilidad distribuida.

**7. Tests automatizados**
No se implementaron pruebas unitarias ni de integración. La confiabilidad del código declarada en la arquitectura no puede verificarse sin tests.

### Conclusión

Tienes una base arquitectónica sólida y demuestra comprensión de los patrones de diseño para sistemas distribuidos basados en eventos. El siguiente paso es fortalecer la atención al contrato funcional del dominio (reglas de negocio, estructuras de datos acordadas) y las prácticas de seguridad aplicadas a datos sensibles. Con ajustes en esas áreas, la solución podría representar una implementación de producción confiable.

¡Mucho éxito en el proceso!

---

*Evaluación generada el 2026-03-19*
