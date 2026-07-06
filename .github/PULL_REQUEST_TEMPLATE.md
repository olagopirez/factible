## Qué cambia

<!-- Descripción breve: qué hace este PR y por qué. Si cierra un issue, mencionalo: Closes #123 -->

## Checklist

- [ ] Los tests pasan (`npm test`) y agregué tests para lo nuevo.
- [ ] `npm run lint` verde (TypeScript estricto, sin `any` gratuitos).
- [ ] Si el cambio toca el comportamiento de un protocolo/formato oficial, **cito la fuente** (documento, sección/página) en el código o en el PR.
- [ ] Si tuve que asumir algo que la spec no aclara, lo anoté en el `TODO.md` del paquete con ⚠️.
- [ ] Los mocks siguen siendo fieles al servicio real ("los mocks no mienten") — si el cambio surge de una respuesta real observada, la incluyo o la describo.
- [ ] README/docs del paquete actualizados si cambia la API pública.

## Cómo probarlo

<!-- Comandos o pasos para verificar el cambio. Si hay e2e opt-in (variables de entorno), mencioná cuál corriste. -->
