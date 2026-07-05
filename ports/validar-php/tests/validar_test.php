<?php
/** Tests sin PHPUnit — correr: php tests/validar_test.php */

declare(strict_types=1);

require __DIR__ . '/../src/Validar.php';

use Factible\Validar;

$fallas = 0;
function check(bool $cond, string $msg): void
{
    global $fallas;
    if (!$cond) {
        $fallas++;
        echo "  ✗ $msg\n";
    } else {
        echo "  ✓ $msg\n";
    }
}

echo "CI:\n";
check(Validar::digitoVerificadorCi('1234567') === 2, 'dígito verificador ejemplo conocido (1234567 → 2)');
check(Validar::validarCi('1.234.567-2'), 'valida con puntos y guión');
check(Validar::validarCi('12345672'), 'valida sin formato');
check(!Validar::validarCi('1.234.567-3'), 'rechaza dv incorrecto');
check(!Validar::validarCi('') && !Validar::validarCi('abc') && !Validar::validarCi('123456789'), 'rechaza basura');
check(Validar::formatearCi('12345672') === '1.234.567-2', 'formatea');

echo "RUT:\n";
check(Validar::validarRut('219999830019'), 'RUT real de DGI válido');
check(Validar::digitoVerificadorRut('21999983001') === 9, 'dígito verificador (→ 9)');
check(!Validar::validarRut('219999830018'), 'rechaza dv incorrecto');
check(Validar::validarRut('21.999983.001-9'), 'acepta formato con puntos');
check(!Validar::validarRut('21999983001') && !Validar::validarRut(''), 'rechaza largo incorrecto');

if ($fallas > 0) {
    echo "\n$fallas tests fallaron\n";
    exit(1);
}
echo "\nTodos los tests pasaron ✓\n";
