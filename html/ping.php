<?php
/* Comprueba que Apache + MySQL + base instalada estén listos.
   El front end usa esta respuesta para decidir el modo API. */
require __DIR__ . "/config.php";

$cn = db(); // si falla, config.php responde 500 y el front usa modo local
try {
    $rs = $cn->query("SELECT COUNT(*) AS n FROM servicios");
    $n = (int)$rs->fetch_assoc()["n"];
    responder(["ok" => true, "servicios" => $n]);
} catch (Exception $e) {
    responder(["error" => "La base existe pero faltan tablas. Ejecutá api/instalar.php"], 500);
}
