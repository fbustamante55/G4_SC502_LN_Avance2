<?php
/* CRUD de servicios (POST crea/actualiza, DELETE elimina). */
require __DIR__ . "/config.php";
$cn = db();
$metodo = $_SERVER["REQUEST_METHOD"];

if ($metodo === "GET") responder(["servicios" => tabla_servicios($cn)]);

if ($metodo === "DELETE") {
    $id = (int)($_GET["id"] ?? 0);
    if (!$id) responder(["error" => "Falta el id."], 400);
    $cn->query("DELETE FROM cita_servicios WHERE servicio_id = $id");
    $cn->query("DELETE FROM servicios WHERE id = $id");
    responder(["servicios" => tabla_servicios($cn)]);
}

if ($metodo !== "POST") responder(["error" => "Método no permitido"], 405);

$b = cuerpo();
$nombre = trim($b["nombre"] ?? "");
$descripcion = trim($b["descripcion"] ?? "");
$precio = (int)($b["precio"] ?? 0);
$duracion = (int)($b["duracion"] ?? 30);
$activo = !empty($b["activo"]) ? 1 : 0;
$grupos = json_encode(array_values($b["grupos"] ?? []), JSON_UNESCAPED_UNICODE);
$id = (int)($b["id"] ?? 0);

if ($nombre === "" || $precio < 0 || $duracion <= 0) responder(["error" => "Datos del servicio inválidos."], 400);

if ($id) {
    $st = $cn->prepare("UPDATE servicios SET nombre=?, descripcion=?, precio=?, duracion=?, activo=?, grupos=? WHERE id=?");
    $st->bind_param("ssiiisi", $nombre, $descripcion, $precio, $duracion, $activo, $grupos, $id);
} else {
    $st = $cn->prepare("INSERT INTO servicios (nombre, descripcion, precio, duracion, activo, grupos) VALUES (?, ?, ?, ?, ?, ?)");
    $st->bind_param("ssiiis", $nombre, $descripcion, $precio, $duracion, $activo, $grupos);
}
$st->execute();
responder(["servicios" => tabla_servicios($cn)]);
