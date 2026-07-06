# Contribuir a factible

Gracias por el interés. Este proyecto vive de conocer cómo funcionan de verdad los servicios del Estado uruguayo — y eso es conocimiento distribuido: cada integración que sufriste es información que acá vale oro.

## Formas de contribuir (de menor a mayor esfuerzo)

1. **Contar tu experiencia.** ¿Integraste con DGI, BPS o AGESIC y sabés la respuesta a alguno de los [supuestos abiertos](packages/cfe/TODO.md)? Comentá en el issue correspondiente. Es la contribución más valiosa y no requiere código.
2. **Reportar problemas** con XML/respuestas reales (redactá los datos sensibles).
3. **Pedir un conector** — [plantilla acá](https://github.com/olagopirez/factible/issues/new?template=conector.yml).
4. **Código**: bugs, tests, nuevos tipos de CFE, conectores nuevos.

## Reglas del código

- **Fiel a la spec:** toda afirmación sobre un formato estatal se respalda con la fuente (los PDFs/XSDs oficiales viven en `packages/*/spec/`). Si es un supuesto sin confirmar, va al TODO del paquete con la marca ⚠️.
- **Todo se testea:** el output XML se valida contra los XSDs oficiales (`xmllint`); los clientes HTTP se testean contra mocks fieles a las respuestas reales.
- **Los mocks no mienten:** si descubrís que la respuesta real de un servicio difiere del mock, arreglar el mock es parte del fix.
- **Español en el dominio:** nombres de API, mensajes de error y docs en español — los conceptos son de DGI/BCU/AGESIC y traducirlos confunde.
- **TypeScript estricto**, sin dependencias nuevas salvo justificación fuerte (los paquetes chicos son cero-deps a propósito).

## Setup

```bash
npm install
npm run build   # en orden de dependencias
npm test        # requiere xmllint (libxml2-utils) para los tests de cfe
```

## Antes del PR

`npm run lint && npm test` verde, y si tocaste un formato oficial, citá la fuente en el commit o el PR.

## Licencia

Al contribuir aceptás que tu aporte se publica bajo MIT.

## Versionado y releases

Usamos [Changesets](https://github.com/changesets/changesets) con [SemVer](https://semver.org/lang/es/): en 0.x, los cambios que rompen API suben la **minor** y el resto sube la **patch**.

### Qué promete cada versión

| Rango | Estado | Significa |
|---|---|---|
| `0.0.x` | Experimental / beta offline | Construido contra la spec, sin validar contra el servicio real (ej: `cfe` hasta homologar ante DGI) |
| `0.x` (x ≥ 1) | Beta validada | Validado end-to-end contra el servicio real, API aún puede cambiar (ej: `bcu`, `montevideo`) |
| `1.0.0` | Estable | Apto para producción; la API solo rompe con major |

En SemVer todo `0.x` es inestable por definición — el "beta" está en el rango, no en un sufijo. Los tags de git siempre espejan la versión exacta publicada en npm.

- **En tu PR**, si tocás un paquete publicable, corré `npx changeset` y elegí el paquete y el tipo de cambio. El archivito generado en `.changeset/` viaja con el PR y se convierte en la entrada del CHANGELOG.
- **Para publicar** (mantenedor): `npm run version` (aplica bumps y changelogs, commitear el resultado) y luego `npm run release` (build + tests + publish a npm + tags git `@factible/paquete@x.y.z`). Después: `git push --follow-tags`.
- Los tags de git son la referencia: cada versión en npm corresponde a un tag en el repo.
