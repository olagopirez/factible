# Ports oficiales

Ports de los paquetes **diminutos, de spec congelada y cero dependencias** a otros lenguajes (ver [política multi-lenguaje](../docs/plan-conectores.md#política-multi-lenguaje)). La lógica pesada (cfe) no se porta: multi-lenguaje vía gateway REST.

| Port | Instalación | Tests |
|---|---|---|
| [validar-python](validar-python) (`factible-validar`) | `pip install factible-validar` | `python -m unittest test_validar` |
| [validar-php](validar-php) (`factible/validar`) | `composer require factible/validar` | `php tests/validar_test.php` |
| [validar-go](validar-go) | `go get github.com/olagopirez/factible/ports/validar-go` | `go test ./...` |
| [validar-java](validar-java) (`uy.factible:validar`) | Maven Central (pendiente) | ver README del port |

Los cuatro implementan el mismo algoritmo con los mismos vectores de test que [`@factible/validar`](../packages/validar) (incluido el RUT real de DGI: `219999830019`). El CI corre los cuatro en cada push.
